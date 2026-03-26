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
    const { action, date_from, date_to } = body;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: config } = await serviceClient
      .from('meta_ads_config')
      .select('access_token, ad_account_id, instagram_account_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!config?.access_token) {
      return new Response(JSON.stringify({ error: 'Meta Ads não configurado. Salve suas credenciais primeiro.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = config.access_token;
    let igAccountId = config.instagram_account_id;

    // Auto-discover IG account if not set
    if (!igAccountId) {
      const pagesResp = await fetch(`${META_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`);
      const pagesData = await pagesResp.json();
      
      if (pagesData.error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar páginas do Facebook. Verifique se o token possui as permissões instagram_basic, instagram_manage_insights e pages_show_list.', details: pagesData.error }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      for (const page of (pagesData.data || [])) {
        if (page.instagram_business_account?.id) {
          igAccountId = page.instagram_business_account.id;
          // Save for future use
          await serviceClient
            .from('meta_ads_config')
            .update({ instagram_account_id: igAccountId })
            .eq('user_id', userId)
            .eq('is_active', true);
          break;
        }
      }

      if (!igAccountId) {
        return new Response(JSON.stringify({ error: 'Nenhuma conta Instagram Business vinculada encontrada. Certifique-se de que sua página do Facebook está conectada a uma conta Instagram Business.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Helper to fetch from Meta API
    async function metaFetch(url: string) {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || 'Meta API error');
      return data;
    }

    const fromDate = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    if (action === 'account_info') {
      const data = await metaFetch(
        `${META_API}/${igAccountId}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${accessToken}`
      );
      return new Response(JSON.stringify({ account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'media') {
      const limit = body.limit || 50;
      const data = await metaFetch(
        `${META_API}/${igAccountId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,media_url,thumbnail_url,permalink&limit=${limit}&access_token=${accessToken}`
      );
      return new Response(JSON.stringify({ media: data.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'top_engaged') {
      // Fetch up to 100 recent posts and sort by engagement
      const data = await metaFetch(
        `${META_API}/${igAccountId}/media?fields=id,caption,like_count,comments_count,timestamp,media_type,media_url,thumbnail_url,permalink&limit=100&access_token=${accessToken}`
      );
      const media = (data.data || [])
        .map((m: any) => ({
          ...m,
          engagement: (m.like_count || 0) + (m.comments_count || 0),
        }))
        .sort((a: any, b: any) => b.engagement - a.engagement)
        .slice(0, 10);

      return new Response(JSON.stringify({ top_posts: media }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'daily_insights') {
      // Account-level daily insights
      const since = Math.floor(new Date(fromDate).getTime() / 1000);
      const until = Math.floor(new Date(toDate).getTime() / 1000) + 86400;
      
      const metrics = 'impressions,reach,follower_count,profile_views';
      const data = await metaFetch(
        `${META_API}/${igAccountId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${accessToken}`
      );

      // Transform to daily format
      const dailyMap: Record<string, any> = {};
      for (const metric of (data.data || [])) {
        for (const val of (metric.values || [])) {
          const date = val.end_time?.split('T')[0];
          if (!date) continue;
          if (!dailyMap[date]) dailyMap[date] = { date };
          dailyMap[date][metric.name] = val.value;
        }
      }

      const daily = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

      return new Response(JSON.stringify({ daily }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação não suportada' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Instagram insights error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
