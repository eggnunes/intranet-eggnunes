import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API = 'https://graph.facebook.com/v25.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action, access_token, ad_account_id, date_from, date_to } = body;

    // If tokens provided in body use them directly; otherwise fetch from DB
    let finalToken = access_token;
    let finalAccountId = ad_account_id;

    if (!finalToken || !finalAccountId) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data: config } = await serviceClient
        .from('meta_ads_config')
        .select('access_token, ad_account_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: 'Meta Ads não configurado. Salve suas credenciais primeiro.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      finalToken = config.access_token;
      finalAccountId = config.ad_account_id;
    }

    // Ensure account id starts with "act_"
    const actId = finalAccountId.startsWith('act_') ? finalAccountId : `act_${finalAccountId}`;

    const fromDate = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    if (action === 'campaigns') {
      const url = `${META_API}/${actId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=50&access_token=${finalToken}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error('Meta API error (campaigns):', data.error);
        return new Response(JSON.stringify({ error: data.error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ campaigns: data.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'insights') {
      const url = `${META_API}/${actId}/insights?fields=campaign_name,campaign_id,impressions,clicks,ctr,cpc,spend,reach,actions&time_range={"since":"${fromDate}","until":"${toDate}"}&level=campaign&limit=50&access_token=${finalToken}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error('Meta API error (insights):', data.error);
        return new Response(JSON.stringify({ error: data.error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ insights: data.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'account_info') {
      const url = `${META_API}/${actId}?fields=name,account_status,currency,timezone_name,amount_spent&access_token=${finalToken}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use: campaigns, insights, account_info' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('meta-ads error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
