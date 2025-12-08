import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rdStationToken = Deno.env.get('RD_STATION_API_TOKEN');
    
    if (!rdStationToken) {
      console.error('RD_STATION_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'RD Station API token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching products from RD Station CRM...');

    // RD Station CRM API uses token as query parameter
    const apiUrl = `https://crm.rdstation.com/api/v1/products?token=${rdStationToken}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RD Station API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Token de API do RD Station inválido ou expirado. Verifique o token nas configurações do CRM.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para acessar produtos. Verifique as permissões do token no RD Station.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao buscar produtos: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Products fetched successfully, count:', Array.isArray(data.products) ? data.products.length : (Array.isArray(data) ? data.length : 0));

    // RD Station returns products in different formats depending on the endpoint version
    const products = data.products || data || [];
    
    return new Response(
      JSON.stringify({ 
        products: Array.isArray(products) ? products : [],
        total: Array.isArray(products) ? products.length : 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in rd-station-products function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao buscar produtos';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});