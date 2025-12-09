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
        JSON.stringify({ error: 'Token do RD Station não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, webhookId } = await req.json();
    console.log('Action requested:', action, 'Webhook ID:', webhookId);

    const baseUrl = 'https://crm.rdstation.com/api/v1/webhooks';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const webhookUrl = `${supabaseUrl}/functions/v1/rdstation-webhook`;

    if (action === 'list') {
      // List all webhooks
      const response = await fetch(`${baseUrl}?token=${rdStationToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('Webhooks listed:', data);
      
      return new Response(
        JSON.stringify({ webhooks: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create') {
      // Create webhook for deal updates
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rdStationToken,
          event_type: 'crm_deal_updated',
          url: webhookUrl,
          http_method: 'POST'
        })
      });

      const data = await response.json();
      console.log('Webhook created:', data);

      if (data.uuid) {
        return new Response(
          JSON.stringify({ success: true, webhook: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: 'Falha ao criar webhook', details: data }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'delete' && webhookId) {
      // Delete webhook
      const response = await fetch(`${baseUrl}/${webhookId}?token=${rdStationToken}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('Webhook deleted:', webhookId);
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook excluído com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorData = await response.text();
        console.error('Delete error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Falha ao excluir webhook', details: errorData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in rd-station-webhooks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
