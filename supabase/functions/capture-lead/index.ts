import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Phone validation (Brazilian format)
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Name validation
function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 200;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rdStationToken = Deno.env.get('RD_STATION_API_TOKEN');
    
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit
    if (isRateLimited(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde um momento.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Honeypot field check - if filled, it's likely a bot
    if (body.website_url) {
      console.warn(`Honeypot triggered by IP: ${clientIp}`);
      // Return success to not alert the bot, but don't save
      return new Response(
        JSON.stringify({ success: true, lead_id: 'ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Received lead capture request from IP:', clientIp);

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
    
    // Validate name
    if (!isValidName(name)) {
      return new Response(
        JSON.stringify({ error: 'Nome inválido (2-200 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate phone format
    if (!isValidPhone(phone)) {
      return new Response(
        JSON.stringify({ error: 'Telefone inválido (formato brasileiro)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'E-mail inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the already captured IP address
    const ip_address = clientIp;

    // Find matching product based on landing page URL
    let product_name: string | null = null;
    if (landing_page) {
      console.log('Checking URL mappings for:', landing_page);
      
      const { data: mappings } = await supabase
        .from('landing_page_product_mappings')
        .select('url_pattern, product_name');
      
      if (mappings && mappings.length > 0) {
        // Find matching pattern (check if landing_page contains the pattern)
        const match = mappings.find(m => {
          const pattern = m.url_pattern.toLowerCase();
          const url = landing_page.toLowerCase();
          // Support both exact match and contains
          return url.includes(pattern) || 
                 url.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        });
        
        if (match) {
          product_name = match.product_name;
          console.log('Matched product:', product_name, 'for URL pattern:', match.url_pattern);
        }
      }
    }

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
        product_name,
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

    console.log('Lead saved:', lead.id, 'Product:', product_name);

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
            cf_produto: product_name || undefined,
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
        product_name,
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
