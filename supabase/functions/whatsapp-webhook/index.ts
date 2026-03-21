import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Always return 200 for OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── GET: Webhook Verification ──
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }

      console.warn('Webhook verification failed — token mismatch');
      return new Response('Forbidden', { status: 200, headers: corsHeaders });
    }

    // ── POST: Incoming messages ──
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('WhatsApp webhook payload:', JSON.stringify(body).slice(0, 500));

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Process each entry (WhatsApp Cloud API structure)
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value || {};

          const messages = value.messages || [];
          const contacts = value.contacts || [];
          const metadata = value.metadata || {};

          // Extract referral from the first message if present (click-to-whatsapp ads)
          const referral = messages[0]?.referral || null;

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const contact = contacts[i] || contacts[0];

            // Only process inbound text/interactive messages
            if (msg.type !== 'text' && msg.type !== 'interactive' && msg.type !== 'button') {
              continue;
            }

            const phone = msg.from; // e.g. "5511999999999"
            const name = contact?.profile?.name || 'WhatsApp Lead';
            const text = msg.text?.body || msg.interactive?.body?.text || msg.button?.text || '';

            console.log(`Processing message from ${phone} (${name}): ${text.slice(0, 80)}`);

            // Dedup: check if lead from this phone exists in last 7 days
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data: existing } = await supabase
              .from('captured_leads')
              .select('id')
              .eq('whatsapp_phone', phone)
              .gte('created_at', sevenDaysAgo)
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`Lead already exists for ${phone}, skipping`);
              continue;
            }

            // Build referral-based UTM data
            let utm_source = 'whatsapp';
            let utm_medium: string | null = 'organic';
            let utm_campaign: string | null = null;
            let utm_content: string | null = null;
            let landing_page: string | null = null;

            if (referral) {
              utm_source = referral.source_type === 'ad' ? 'facebook' : 'whatsapp';
              utm_medium = referral.source_type === 'ad' ? 'paid' : 'organic';
              utm_campaign = referral.headline || null;
              utm_content = referral.body || null;
              landing_page = referral.source_url || null;
            }

            // Find matching product from landing page
            let product_name: string | null = null;
            if (landing_page) {
              const { data: mappings } = await supabase
                .from('landing_page_product_mappings')
                .select('url_pattern, product_name');

              if (mappings) {
                const match = mappings.find((m: any) => {
                  const pattern = m.url_pattern.toLowerCase();
                  const url = landing_page!.toLowerCase();
                  return url.includes(pattern);
                });
                if (match) product_name = match.product_name;
              }
            }

            const { error: insertError } = await supabase
              .from('captured_leads')
              .insert({
                name,
                phone,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_content,
                landing_page,
                product_name,
                whatsapp_phone: phone,
                whatsapp_message: text.slice(0, 1000),
                whatsapp_referral: referral,
              });

            if (insertError) {
              console.error('Error inserting WhatsApp lead:', insertError);
            } else {
              console.log(`WhatsApp lead saved for ${phone}`);
            }
          }
        }
      }

      // Always return 200 to Meta
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Always return 200 to prevent Meta from retrying
    return new Response(JSON.stringify({ error: 'processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
