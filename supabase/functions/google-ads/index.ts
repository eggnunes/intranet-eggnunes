import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v17';

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!;
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')!;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await resp.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

async function gaqlQuery(customerId: string, accessToken: string, query: string): Promise<any[]> {
  const devToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!;
  const cid = customerId.replace(/-/g, '');

  const resp = await fetch(`${GOOGLE_ADS_API}/customers/${cid}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': devToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await resp.json();
  if (data.error) {
    console.error('Google Ads API error:', data.error);
    throw new Error(data.error.message || 'Google Ads API error');
  }

  // searchStream returns array of batches
  const results: any[] = [];
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) results.push(...batch.results);
    }
  }
  return results;
}

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

    const body = await req.json();
    const { action, date_from, date_to } = body;

    const customerId = Deno.env.get('GOOGLE_ADS_CUSTOMER_ID')!;
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Google Ads não configurado. GOOGLE_ADS_CUSTOMER_ID não encontrado.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken();

    const fromDate = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = date_to || new Date().toISOString().split('T')[0];

    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ==================== CAMPAIGNS ====================
    if (action === 'campaigns') {
      const query = `
        SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
               campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;
      const results = await gaqlQuery(customerId, accessToken, query);
      const campaigns = results.map((r: any) => ({
        id: r.campaign?.id,
        name: r.campaign?.name,
        status: r.campaign?.status,
        channel_type: r.campaign?.advertisingChannelType,
        budget_micros: r.campaignBudget?.amountMicros,
      }));
      return json({ campaigns });
    }

    // ==================== INSIGHTS (per campaign) ====================
    if (action === 'insights') {
      const query = `
        SELECT campaign.id, campaign.name,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.ctr, metrics.average_cpc,
               metrics.average_cpm
        FROM campaign
        WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
          AND campaign.status != 'REMOVED'
      `;
      const results = await gaqlQuery(customerId, accessToken, query);

      // Aggregate by campaign
      const campaignMap: Record<string, any> = {};
      for (const r of results) {
        const id = r.campaign?.id;
        if (!id) continue;
        if (!campaignMap[id]) {
          campaignMap[id] = {
            campaign_id: id,
            campaign_name: r.campaign?.name || 'Sem nome',
            impressions: 0, clicks: 0, cost_micros: 0, conversions: 0,
          };
        }
        const m = r.metrics || {};
        campaignMap[id].impressions += parseInt(m.impressions || '0');
        campaignMap[id].clicks += parseInt(m.clicks || '0');
        campaignMap[id].cost_micros += parseInt(m.costMicros || '0');
        campaignMap[id].conversions += parseFloat(m.conversions || '0');
      }

      const insights = Object.values(campaignMap).map((c: any) => {
        const spend = c.cost_micros / 1_000_000;
        return {
          campaign_id: c.campaign_id,
          campaign_name: c.campaign_name,
          impressions: String(c.impressions),
          clicks: String(c.clicks),
          spend: spend.toFixed(2),
          conversions: String(Math.round(c.conversions)),
          ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0',
          cpc: c.clicks > 0 ? (spend / c.clicks).toFixed(2) : '0',
          cpm: c.impressions > 0 ? ((spend / c.impressions) * 1000).toFixed(2) : '0',
        };
      });

      return json({ insights });
    }

    // ==================== DAILY INSIGHTS ====================
    if (action === 'daily_insights') {
      const query = `
        SELECT segments.date,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.ctr, metrics.average_cpc
        FROM campaign
        WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
          AND campaign.status != 'REMOVED'
      `;
      const results = await gaqlQuery(customerId, accessToken, query);

      // Aggregate by date
      const dateMap: Record<string, any> = {};
      for (const r of results) {
        const date = r.segments?.date;
        if (!date) continue;
        if (!dateMap[date]) {
          dateMap[date] = { date_start: date, impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 };
        }
        const m = r.metrics || {};
        dateMap[date].impressions += parseInt(m.impressions || '0');
        dateMap[date].clicks += parseInt(m.clicks || '0');
        dateMap[date].cost_micros += parseInt(m.costMicros || '0');
        dateMap[date].conversions += parseFloat(m.conversions || '0');
      }

      const daily = Object.values(dateMap)
        .sort((a: any, b: any) => a.date_start.localeCompare(b.date_start))
        .map((d: any) => {
          const spend = d.cost_micros / 1_000_000;
          return {
            date_start: d.date_start,
            impressions: String(d.impressions),
            clicks: String(d.clicks),
            spend: spend.toFixed(2),
            conversions: String(Math.round(d.conversions)),
            ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0',
            cpc: d.clicks > 0 ? (spend / d.clicks).toFixed(2) : '0',
          };
        });

      return json({ daily });
    }

    // ==================== ACCOUNT INFO ====================
    if (action === 'account_info') {
      const query = `
        SELECT customer.id, customer.descriptive_name, customer.currency_code,
               customer.status
        FROM customer
        LIMIT 1
      `;
      const results = await gaqlQuery(customerId, accessToken, query);
      const customer = results[0]?.customer || {};
      return json({
        account: {
          id: customer.id,
          name: customer.descriptiveName,
          currency: customer.currencyCode,
          status: customer.status,
        },
      });
    }

    return json({ error: 'Ação inválida.' }, 400);

  } catch (error) {
    console.error('google-ads error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
