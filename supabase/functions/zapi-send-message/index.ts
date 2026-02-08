import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_OFICIAL = '553132268742';
const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg & Nunes Advogados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

// Brazilian phone validation regex
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: ${phone}`);
  }
  return fullPhone;
}

async function sendZAPIMessage(phone: string, message: string): Promise<{ zaapId?: string; messageId?: string; success: boolean }> {
  const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
  const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
  const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

  console.log(`[Z-API] Credentials debug - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}, Client Token length: ${ZAPI_CLIENT_TOKEN.length}`);
  console.log(`[Z-API] Instance ID starts with: "${ZAPI_INSTANCE_ID.substring(0, 4)}..." ends with: "...${ZAPI_INSTANCE_ID.substring(ZAPI_INSTANCE_ID.length - 4)}"`);

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const fullPhone = validateBrazilianPhone(phone);
  
  // Append the footer disclaimer to every message
  const fullMessage = message + FOOTER_AVISO;

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  console.log(`[Z-API] Sending message to ${fullPhone}`);
  console.log(`[Z-API] URL: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone: fullPhone,
      message: fullMessage,
    }),
  });

  const responseText = await response.text();
  console.log(`[Z-API] Response status: ${response.status}`);
  console.log(`[Z-API] Response body: ${responseText}`);

  if (!response.ok) {
    throw new Error(`Z-API error (${response.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Z-API returned invalid JSON: ${responseText.substring(0, 200)}`);
  }

  return {
    zaapId: data.zaapId,
    messageId: data.messageId,
    success: true,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Action: setup-webhooks - register all webhook URLs via Z-API API
    if (action === 'setup-webhooks') {
      const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
      const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
      const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

      if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciais da Z-API não configuradas' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
      const webhookUrl = `${SUPABASE_URL}/functions/v1/zapi-webhook`;

      console.log(`[Z-API] Setting up webhooks with URL: ${webhookUrl}`);

      const baseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
      const headers = {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      };

      const webhookConfigs = [
        { endpoint: '/update-webhook-received', body: { value: webhookUrl }, name: 'ReceivedCallback (mensagens recebidas)' },
        { endpoint: '/update-webhook-delivery', body: { value: webhookUrl }, name: 'DeliveryCallback (confirmação de entrega)' },
        { endpoint: '/update-webhook-message-status', body: { value: webhookUrl }, name: 'MessageStatusCallback (status de mensagem)' },
        { endpoint: '/update-webhook-chat-presence', body: { value: webhookUrl }, name: 'ChatPresenceCallback (presença no chat)' },
        { endpoint: '/update-webhook-disconnected', body: { value: webhookUrl }, name: 'DisconnectedCallback (desconexão)' },
        { endpoint: '/update-webhook-connected', body: { value: webhookUrl }, name: 'ConnectedCallback (conexão)' },
      ];

      const results: { name: string; success: boolean; error?: string }[] = [];

      for (const config of webhookConfigs) {
        try {
          const resp = await fetch(`${baseUrl}${config.endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(config.body),
          });
          const respText = await resp.text();
          console.log(`[Z-API] ${config.name}: ${resp.status} - ${respText}`);
          results.push({ name: config.name, success: resp.ok, error: resp.ok ? undefined : respText });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Z-API] Error setting ${config.name}:`, errorMsg);
          results.push({ name: config.name, success: false, error: errorMsg });
        }
      }

      // Ativar notifySentByMe para receber eventos de mensagens enviadas por mim
      try {
        const sentByMeResp = await fetch(`${baseUrl}/update-webhook-received`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ value: webhookUrl, notifySentByMe: true }),
        });
        const sentByMeText = await sentByMeResp.text();
        console.log(`[Z-API] notifySentByMe: ${sentByMeResp.status} - ${sentByMeText}`);
        results.push({ name: 'notifySentByMe (mensagens enviadas por mim)', success: sentByMeResp.ok, error: sentByMeResp.ok ? undefined : sentByMeText });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({ name: 'notifySentByMe', success: false, error: errorMsg });
      }

      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      return new Response(
        JSON.stringify({
          success: allSuccess,
          message: `${successCount}/${results.length} webhooks configurados com sucesso.`,
          webhookUrl,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: test-connection - just verify Z-API credentials work
    if (action === 'test-connection') {
      const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
      const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
      const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

      console.log(`[Z-API] test-connection - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}, Client Token length: ${ZAPI_CLIENT_TOKEN.length}`);
      console.log(`[Z-API] Instance ID: "${ZAPI_INSTANCE_ID.substring(0, 4)}...${ZAPI_INSTANCE_ID.substring(ZAPI_INSTANCE_ID.length - 4)}"`);

      if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciais da Z-API não configuradas' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Test by checking instance status
      const statusUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`;
      const statusResponse = await fetch(statusUrl, {
        headers: { 'Client-Token': ZAPI_CLIENT_TOKEN },
      });
      const statusData = await statusResponse.json();
      console.log('[Z-API] Status check:', statusData);

      return new Response(
        JSON.stringify({ 
          success: statusResponse.ok, 
          status: statusData,
          connected: statusData?.connected || statusData?.smartphoneConnected || false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: send-message - send a single message
    if (action === 'send-message') {
      const { phone, message } = body;

      if (!phone || !message) {
        return new Response(
          JSON.stringify({ error: 'phone e message são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendZAPIMessage(phone, message);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: send-bulk - send messages with 3-minute intervals (uses background task)
    if (action === 'send-bulk') {
      const { messages: messagesList } = body;
      // messagesList: Array<{ phone: string, message: string, customerId?: string, customerName?: string, type?: string }>

      if (!Array.isArray(messagesList) || messagesList.length === 0) {
        return new Response(
          JSON.stringify({ error: 'messages deve ser um array não vazio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Z-API] Bulk send requested: ${messagesList.length} messages`);

      // Process in background with 3-minute intervals
      const processBulk = async () => {
        let sent = 0;
        let failed = 0;
        const errors: { phone: string; error: string }[] = [];
        const INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

        for (let i = 0; i < messagesList.length; i++) {
          const msg = messagesList[i];
          try {
            console.log(`[Z-API] Sending bulk message ${i + 1}/${messagesList.length} to ${msg.phone}`);
            const result = await sendZAPIMessage(msg.phone, msg.message);

            // Log the message
            await supabase.from('zapi_messages_log').insert({
              customer_id: msg.customerId || null,
              customer_name: msg.customerName || null,
              customer_phone: msg.phone.replace(/\D/g, ''),
              message_text: msg.message,
              message_type: msg.type || 'aviso',
              status: 'sent',
              zapi_message_id: result.zaapId || result.messageId || null,
              sent_at: new Date().toISOString(),
              sent_by: user.id,
            }).then(({ error }) => {
              if (error) console.error('[Z-API] Error logging message:', error);
            });

            sent++;
            console.log(`[Z-API] ✓ Message ${i + 1} sent successfully`);

            // Wait 3 minutes between messages (except for the last one)
            if (i < messagesList.length - 1) {
              console.log(`[Z-API] Waiting 3 minutes before next message...`);
              await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Z-API] ✗ Failed to send message ${i + 1}:`, errorMsg);
            failed++;
            errors.push({ phone: msg.phone, error: errorMsg });

            // Log the failure
            await supabase.from('zapi_messages_log').insert({
              customer_id: msg.customerId || null,
              customer_name: msg.customerName || null,
              customer_phone: msg.phone.replace(/\D/g, ''),
              message_text: msg.message,
              message_type: msg.type || 'aviso',
              status: 'failed',
              error_message: errorMsg,
              sent_by: user.id,
            }).then(({ error: logError }) => {
              if (logError) console.error('[Z-API] Error logging failed message:', logError);
            });

            // Still wait between messages even if one fails
            if (i < messagesList.length - 1) {
              await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
            }
          }
        }

        console.log(`[Z-API] Bulk send complete: ${sent} sent, ${failed} failed`);
      };

      // Start background processing
      EdgeRuntime.waitUntil(processBulk());

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Envio de ${messagesList.length} mensagens iniciado. As mensagens serão enviadas com intervalo de 3 minutos entre cada uma.`,
          totalMessages: messagesList.length,
          estimatedTimeMinutes: (messagesList.length - 1) * 3,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida. Use: test-connection, send-message, send-bulk, setup-webhooks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Z-API] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
