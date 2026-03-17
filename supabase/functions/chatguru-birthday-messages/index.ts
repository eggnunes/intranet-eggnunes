import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region',
};

const BIRTHDAY_DIALOG_ID = '6977a8b42fc8f7656b256f9b';
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_MESSAGES_PER_RUN = 35;

function getSafeErrorMessage(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('telefone inválido') || errorMessage.includes('formato')) return 'Número de telefone inválido';
  if (errorMessage.includes('ChatGuru') || errorMessage.includes('API') || errorMessage.includes('comunicação')) return 'Erro ao enviar mensagem';
  if (errorMessage.includes('credentials') || errorMessage.includes('Credenciais')) return 'Sistema de mensagens não configurado';
  return 'Erro ao processar solicitação';
}

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) fullPhone = `55${cleanPhone}`;
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) throw new Error('Número de telefone com formato inválido');
  return fullPhone;
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

// ===== ChatGuru functions (fallback) =====
async function setChatStatusToAttending(phone: string): Promise<boolean> {
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY')!;
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID')!;
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID')!;

  const params = new URLSearchParams({
    key: CHATGURU_API_KEY, account_id: CHATGURU_ACCOUNT_ID, phone_id: CHATGURU_PHONE_ID,
    action: 'chat_edit', chat_number: phone, status: 'em atendimento',
  });

  try {
    const response = await fetchWithTimeout(`https://s17.chatguru.app/api/v1?${params.toString()}`, { method: 'POST' });
    const data = JSON.parse(await response.text());
    return data.result === 'success';
  } catch (error) {
    console.error('[ChatGuru] Error changing chat status:', error);
    return false;
  }
}

async function sendBirthdayViaDialog(phone: string, customerName: string): Promise<{ messageId?: string; success: boolean }> {
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

  if (!CHATGURU_API_KEY || !CHATGURU_ACCOUNT_ID || !CHATGURU_PHONE_ID) throw new Error('Credenciais do ChatGuru não configuradas');

  const fullPhone = validateBrazilianPhone(phone);

  const dialogParams = new URLSearchParams({
    key: CHATGURU_API_KEY, account_id: CHATGURU_ACCOUNT_ID, phone_id: CHATGURU_PHONE_ID,
    action: 'dialog_execute', chat_number: fullPhone, dialog_id: BIRTHDAY_DIALOG_ID,
  });

  const dialogResponse = await fetchWithTimeout(`https://s17.chatguru.app/api/v1?${dialogParams.toString()}`, { method: 'POST' });
  const dialogData = JSON.parse(await dialogResponse.text());

  if (dialogData.result === 'success') {
    await setChatStatusToAttending(fullPhone);
    return { messageId: dialogData.message_id, success: true };
  }

  if (dialogData.description?.includes('Chat não encontrado') || dialogData.code === 400) {
    const chatAddParams = new URLSearchParams({
      key: CHATGURU_API_KEY, account_id: CHATGURU_ACCOUNT_ID, phone_id: CHATGURU_PHONE_ID,
      action: 'chat_add', chat_number: fullPhone, name: customerName,
      text: 'aniversario_cliente', dialog_id: BIRTHDAY_DIALOG_ID,
    });

    const chatAddResponse = await fetchWithTimeout(`https://s17.chatguru.app/api/v1?${chatAddParams.toString()}`, { method: 'POST' });
    const chatAddData = JSON.parse(await chatAddResponse.text());

    if (chatAddData.result === 'success') {
      await setChatStatusToAttending(fullPhone);
      return { messageId: chatAddData.message_id, success: true };
    }
    throw new Error('Falha ao criar conversa no WhatsApp');
  }

  throw new Error('Falha ao enviar mensagem via WhatsApp');
}

// ===== Z-API send function =====
async function sendBirthdayViaZapi(phone: string, customerName: string, messageTemplate: string): Promise<{ success: boolean }> {
  const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')?.trim();
  const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')?.trim();
  const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')?.trim();

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) throw new Error('Credenciais Z-API não configuradas');

  const fullPhone = validateBrazilianPhone(phone);
  const firstName = customerName.split(' ')[0];

  // Replace variables in template
  let message = messageTemplate
    .split('{nome}').join(customerName)
    .split('{primeiro_nome}').join(firstName);

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: fullPhone, message }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Z-API] Send failed:', data);
    throw new Error('Falha ao enviar via Z-API');
  }

  return { success: true };
}

function getBrazilDate(): { day: number; month: number; todayStart: string } {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  const day = brazilTime.getDate();
  const month = brazilTime.getMonth() + 1;
  const todayStart = new Date(brazilTime.getFullYear(), brazilTime.getMonth(), brazilTime.getDate()).toISOString();
  return { day, month, todayStart };
}

interface CustomerInput {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Acesso restrito - apenas administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch automation rule for birthday
    const { data: automationRule } = await supabase
      .from('whatsapp_automation_rules')
      .select('*')
      .eq('type', 'birthday')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const sendVia = automationRule?.send_via || 'chatguru';
    const intervalMs = (automationRule?.interval_seconds || 120) * 1000;
    const messageTemplate = automationRule?.message_template || '';

    console.log(`Birthday automation: send_via=${sendVia}, interval=${intervalMs}ms`);

    // Validate credentials based on channel
    if (sendVia === 'chatguru') {
      if (!Deno.env.get('CHATGURU_API_KEY') || !Deno.env.get('CHATGURU_ACCOUNT_ID') || !Deno.env.get('CHATGURU_PHONE_ID')) {
        throw new Error('Credenciais do ChatGuru não configuradas');
      }
    } else {
      if (!Deno.env.get('ZAPI_INSTANCE_ID') || !Deno.env.get('ZAPI_TOKEN')) {
        throw new Error('Credenciais Z-API não configuradas');
      }
    }

    // Parse request body
    let bodyCustomers: CustomerInput[] = [];
    try {
      const body = await req.json();
      bodyCustomers = body?.customers || [];
    } catch {
      // Empty body is ok
    }

    const { day: currentDay, month: currentMonth, todayStart } = getBrazilDate();
    console.log(`Birthday check: day=${currentDay}, month=${currentMonth}, received ${bodyCustomers.length} customers`);

    if (bodyCustomers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum aniversariante enviado pelo frontend', results: { total: 0, sent: 0, failed: 0, remaining: 0, alreadySentToday: 0, errors: [] } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Server-side validation
    const todayBirthdays = bodyCustomers.filter(c => {
      if (!c.phone || !c.birthday) return false;
      try {
        const d = new Date(c.birthday);
        return d.getDate() === currentDay && (d.getMonth() + 1) === currentMonth;
      } catch {
        return false;
      }
    });

    // Fetch exclusions + idempotency
    const { data: exclusions } = await supabase.from('customer_birthday_exclusions').select('customer_id');
    const excludedIds = new Set((exclusions || []).map((e: any) => e.customer_id));

    const { data: alreadySentData } = await supabase
      .from('chatguru_birthday_messages_log')
      .select('customer_id')
      .eq('status', 'sent')
      .gte('created_at', todayStart);

    const alreadySentIds = new Set((alreadySentData || []).map((e: any) => e.customer_id));
    const alreadySentToday = alreadySentIds.size;

    const customersToMessage = todayBirthdays
      .filter(c => !excludedIds.has(c.id) && !alreadySentIds.has(c.id))
      .slice(0, MAX_MESSAGES_PER_RUN);

    const totalEligible = todayBirthdays.filter(c => !excludedIds.has(c.id) && !alreadySentIds.has(c.id)).length;

    console.log(`${customersToMessage.length} to send (${totalEligible} eligible, ${alreadySentToday} already sent) via ${sendVia}`);

    // For Z-API with long intervals, use background processing
    if (sendVia === 'zapi' && customersToMessage.length > 0 && intervalMs >= 60000) {
      // Background processing for long intervals
      const bgResults = {
        total: customersToMessage.length,
        sent: 0,
        failed: 0,
        remaining: Math.max(0, totalEligible - customersToMessage.length),
        alreadySentToday,
        errors: [] as { customer: string; error: string }[],
      };

      // Use EdgeRuntime.waitUntil for background processing
      const bgPromise = (async () => {
        for (let i = 0; i < customersToMessage.length; i++) {
          const customer = customersToMessage[i];
          try {
            console.log(`[BG ${i + 1}/${customersToMessage.length}] Sending to ${customer.name} via Z-API`);
            await sendBirthdayViaZapi(customer.phone!, customer.name, messageTemplate);

            await supabase.from('chatguru_birthday_messages_log').insert({
              customer_id: customer.id,
              customer_name: customer.name,
              customer_phone: customer.phone,
              message_text: `Mensagem de aniversário enviada via Z-API para ${customer.name}`,
              status: 'sent',
            });
            bgResults.sent++;
          } catch (error: unknown) {
            const safeError = getSafeErrorMessage(error);
            console.error(`✗ Failed for ${customer.name}:`, error instanceof Error ? error.message : String(error));

            await supabase.from('chatguru_birthday_messages_log').insert({
              customer_id: customer.id,
              customer_name: customer.name,
              customer_phone: customer.phone!,
              message_text: `Falha no envio via Z-API para ${customer.name}`,
              status: 'failed',
              error_message: safeError,
            });
            bgResults.failed++;
          }

          // Wait interval between messages (except last)
          if (i < customersToMessage.length - 1) {
            console.log(`⏳ Waiting ${intervalMs / 1000}s before next message...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        }
        console.log('Background birthday sending completed:', bgResults);
      })();

      // Use EdgeRuntime.waitUntil if available, otherwise just fire-and-forget
      try {
        (EdgeRuntime as any).waitUntil(bgPromise);
      } catch {
        // EdgeRuntime.waitUntil not available, just let it run
        bgPromise.catch(e => console.error('Background send error:', e));
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Envio iniciado em background via Z-API. ${customersToMessage.length} mensagem(ns) serão enviadas com intervalo de ${intervalMs / 1000}s.`,
          results: {
            total: customersToMessage.length,
            sent: 0,
            failed: 0,
            remaining: bgResults.remaining,
            alreadySentToday,
            errors: [],
            backgroundProcessing: true,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Synchronous processing (ChatGuru or Z-API with short intervals)
    const MAX_EXECUTION_MS = 120_000;
    const startTime = Date.now();
    const results = {
      total: customersToMessage.length,
      sent: 0,
      failed: 0,
      remaining: Math.max(0, totalEligible - customersToMessage.length),
      alreadySentToday,
      errors: [] as { customer: string; error: string }[],
    };

    for (let i = 0; i < customersToMessage.length; i++) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        results.remaining += customersToMessage.length - i;
        console.log(`⏳ Time guardrail at ${i}/${customersToMessage.length}.`);
        break;
      }

      const customer = customersToMessage[i];
      try {
        console.log(`[${i + 1}/${customersToMessage.length}] Sending to ${customer.name} via ${sendVia}`);

        if (sendVia === 'zapi') {
          await sendBirthdayViaZapi(customer.phone!, customer.name, messageTemplate);
        } else {
          await sendBirthdayViaDialog(customer.phone!, customer.name);
        }

        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada via ${sendVia === 'zapi' ? 'Z-API' : 'ChatGuru'} para ${customer.name}`,
          status: 'sent',
        });

        results.sent++;
      } catch (error: unknown) {
        const safeError = getSafeErrorMessage(error);
        console.error(`✗ Failed for ${customer.name}:`, error instanceof Error ? error.message : String(error));

        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!,
          message_text: `Falha no envio para ${customer.name}`,
          status: 'failed',
          error_message: safeError,
        });

        results.failed++;
        results.errors.push({ customer: customer.name, error: safeError });
      }

      if (i < customersToMessage.length - 1 && Date.now() - startTime < MAX_EXECUTION_MS) {
        await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, 2000)));
      }
    }

    console.log('Birthday automation completed:', results);

    return new Response(
      JSON.stringify({ success: true, message: 'Automação de mensagens de aniversário concluída', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in birthday messages automation:', error);
    return new Response(
      JSON.stringify({ success: false, error: getSafeErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
