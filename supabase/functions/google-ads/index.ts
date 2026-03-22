import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN")!;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error("Token refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

async function queryGoogleAds(accessToken: string, query: string) {
  const customerId = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID")!;
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
  const loginCustomerId = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")!;
  const url = "https://googleads.googleapis.com/v19/customers/" + customerId + "/googleAds:searchStream";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + accessToken, "developer-token": developerToken, "login-customer-id": loginCustomerId, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Google Ads API error (HTTP " + response.status + "): " + errorText.substring(0, 500));
  }
  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action } = await req.json();
    const accessToken = await getAccessToken();
    if (action === "campaigns") {
      const query = "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING LAST_30_DAYS";
      const results = await queryGoogleAds(accessToken, query);
      let campaigns = [];
      let totals = { impressions: 0, clicks: 0, conversions: 0, cost: 0 };
      const allResults = Array.isArray(results) ? results.flatMap((d: any) => d.results || []) : (results.results || []);
      if (allResults.length > 0) {
        campaigns = allResults.map((row: any) => {
          const imp = parseInt(row.metrics?.impressions || "0");
          const cli = parseInt(row.metrics?.clicks || "0");
          const conv = parseFloat(row.metrics?.conversions || "0");
          const cost = parseInt(row.metrics?.costMicros || "0") / 1000000;
          totals.impressions += imp;
          totals.clicks += cli;
          totals.conversions += conv;
          totals.cost += cost;
          return { id: row.campaign?.id, name: row.campaign?.name, status: row.campaign?.status, impressions: imp, clicks: cli, ctr: imp > 0 ? ((cli / imp) * 100).toFixed(2) : "0", cpc: cli > 0 ? (cost / cli).toFixed(2) : "0", conversions: conv, cost: cost.toFixed(2) };
        });
      }
      return new Response(JSON.stringify({ campaigns, totals: { ...totals, ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0", cpc: totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : "0", cost: totals.cost.toFixed(2) } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "insights" || action === "daily_insights") {
      const query = "SELECT segments.date, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros FROM customer WHERE segments.date DURING LAST_30_DAYS";
      const results = await queryGoogleAds(accessToken, query);
      let dailyData = [];
      const allResults = Array.isArray(results) ? results.flatMap((d: any) => d.results || []) : (results.results || []);
      if (allResults.length > 0) {
        dailyData = allResults.map((row: any) => ({ date: row.segments?.date, impressions: parseInt(row.metrics?.impressions || "0"), clicks: parseInt(row.metrics?.clicks || "0"), conversions: parseFloat(row.metrics?.conversions || "0"), cost: (parseInt(row.metrics?.costMicros || "0") / 1000000).toFixed(2) }));
      }
      return new Response(JSON.stringify({ daily_data: dailyData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "account_info") {
      return new Response(JSON.stringify({ account_id: Deno.env.get("GOOGLE_ADS_CUSTOMER_ID"), name: "Egg Nunes Advogados", status: "ENABLED" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
