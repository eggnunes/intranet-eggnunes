import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdStationToken = Deno.env.get('RD_STATION_API_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received lead capture request:', body);

    const {
      form_id,
      name,
      email,
      phone,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      landing_page,
      referrer,
      user_agent,
    } = body;

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Nome e telefone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP from headers
    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

    // Save lead to database
    const { data: lead, error: insertError } = await supabase
      .from('captured_leads')
      .insert({
        form_id: form_id || null,
        name,
        email: email || null,
        phone,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
        landing_page: landing_page || null,
        referrer: referrer || null,
        user_agent: user_agent || null,
        ip_address,
        rd_station_synced: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead saved:', lead.id);

    // Sync with RD Station if token is available
    let rdStationSynced = false;
    let rdStationError = null;

    if (rdStationToken) {
      try {
        const rdPayload = {
          event_type: 'CONVERSION',
          event_family: 'CDP',
          payload: {
            conversion_identifier: 'formulario-intranet',
            name,
            email: email || undefined,
            mobile_phone: phone,
            cf_utm_source: utm_source || undefined,
            cf_utm_medium: utm_medium || undefined,
            cf_utm_campaign: utm_campaign || undefined,
            cf_utm_content: utm_content || undefined,
            cf_utm_term: utm_term || undefined,
            cf_landing_page: landing_page || undefined,
          }
        };

        console.log('Sending to RD Station:', rdPayload);

        const rdResponse = await fetch('https://api.rd.services/platform/conversions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${rdStationToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rdPayload),
        });

        if (rdResponse.ok) {
          rdStationSynced = true;
          console.log('Lead synced with RD Station');
        } else {
          const rdError = await rdResponse.text();
          rdStationError = rdError;
          console.error('RD Station sync error:', rdError);
        }
      } catch (rdErr) {
        rdStationError = rdErr instanceof Error ? rdErr.message : 'Unknown error';
        console.error('RD Station sync exception:', rdErr);
      }

      // Update lead with RD Station sync status
      await supabase
        .from('captured_leads')
        .update({
          rd_station_synced: rdStationSynced,
          rd_station_sync_error: rdStationError,
        })
        .eq('id', lead.id);
    }

    // Get form configuration for WhatsApp redirect
    let whatsappUrl = null;
    if (form_id) {
      const { data: form } = await supabase
        .from('lead_capture_forms')
        .select('whatsapp_number, whatsapp_message, redirect_to_whatsapp')
        .eq('id', form_id)
        .single();

      if (form && form.redirect_to_whatsapp && form.whatsapp_number) {
        const message = (form.whatsapp_message || 'Olá! Gostaria de mais informações.')
          .replace('{nome}', name)
          .replace('{telefone}', phone);
        const encodedMessage = encodeURIComponent(message);
        whatsappUrl = `https://wa.me/${form.whatsapp_number.replace(/\D/g, '')}?text=${encodedMessage}`;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        rd_station_synced: rdStationSynced,
        whatsapp_url: whatsappUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in capture-lead function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
