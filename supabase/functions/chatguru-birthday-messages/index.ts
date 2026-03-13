import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region',
};

const BIRTHDAY_DIALOG_ID = '6977a8b42fc8f7656b256f9b';
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;
const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';

// Throttle between messages: 2 seconds
const THROTTLE_MS = 2000;
// Max execution time guardrail: 130 seconds
const MAX_EXECUTION_MS = 130_000;
// Fetch timeout for external APIs: 15 seconds
const FETCH_TIMEOUT_MS = 15_000;

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

  // Step 1: dialog_execute
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

  // Step 2: chat_add fallback
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

interface Customer {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
}

function getBrazilDate(): { day: number; month: number; todayStart: string } {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  const day = brazilTime.getDate();
  const month = brazilTime.getMonth() + 1;
  // Start of today in BRT as ISO string
  const todayStart = new Date(brazilTime.getFullYear(), brazilTime.getMonth(), brazilTime.getDate()).toISOString();
  return { day, month, todayStart };
}

async function fetchBirthdaysFromAdvbox(): Promise<any[]> {
  const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
  if (!ADVBOX_TOKEN) throw new Error('ADVBOX_API_TOKEN não configurado');

  let allCustomers: any[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${ADVBOX_API_BASE}/customers?limit=${limit}&offset=${offset}`;
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADVBOX_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log('[Advbox] Rate limited, waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Advbox API error: ${response.status} - ${text.substring(0, 200)}`);
      }

      const data = await response.json();
      const items = data.data || [];
      const totalCount = data.totalCount || 0;

      allCustomers = allCustomers.concat(items);
      offset += items.length;

      if (items.length < limit || (totalCount > 0 && offset >= totalCount)) hasMore = false;
      if (hasMore) await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Timeout ao buscar clientes do Advbox');
      }
      throw error;
    }
  }

  console.log(`[Advbox] Fetched ${allCustomers.length} total customers`);
  return allCustomers;
}

function parseBirthdayDayMonth(raw: string): { day: number; month: number } | null {
  const str = String(raw);
  let day: number | undefined, month: number | undefined;

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length >= 2) { day = parseInt(parts[0]); month = parseInt(parts[1]); }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) { month = parseInt(parts[1]); day = parseInt(parts[2]); }
      else { day = parseInt(parts[0]); month = parseInt(parts[1]); }
    }
  }

  if (!day || !month || isNaN(day) || isNaN(month)) return null;
  return { day, month };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Verify ChatGuru credentials
    if (!Deno.env.get('CHATGURU_API_KEY') || !Deno.env.get('CHATGURU_ACCOUNT_ID') || !Deno.env.get('CHATGURU_PHONE_ID')) {
      throw new Error('Credenciais do ChatGuru não configuradas');
    }

    const { day: currentDay, month: currentMonth, todayStart } = getBrazilDate();
    console.log(`Checking birthdays for: day=${currentDay}, month=${currentMonth}`);

    // Fetch all customers from Advbox
    const allAdvboxCustomers = await fetchBirthdaysFromAdvbox();

    // Filter today's birthdays
    const todayBirthdays: Customer[] = allAdvboxCustomers
      .filter((c: any) => {
        const rawBirth = c.birthdate || c.birthday || c.birth_date;
        const rawPhone = c.cellphone || c.mobile_phone || c.phone;
        if (!rawBirth || !rawPhone) return false;
        const parsed = parseBirthdayDayMonth(rawBirth);
        if (!parsed) return false;
        return parsed.day === currentDay && parsed.month === currentMonth;
      })
      .map((c: any) => ({
        id: String(c.id ?? c.customer_id ?? ''),
        name: c.name ?? '',
        phone: c.cellphone || c.mobile_phone || c.phone,
        birthday: c.birthdate || c.birthday || c.birth_date,
      }));

    console.log(`Found ${todayBirthdays.length} customers with birthdays today`);

    // Fetch exclusions
    const { data: exclusions } = await supabase.from('customer_birthday_exclusions').select('customer_id');
    const excludedIds = new Set((exclusions || []).map((e: any) => e.customer_id));

    // IDEMPOTENCY: Fetch already sent today
    const { data: alreadySentData } = await supabase
      .from('chatguru_birthday_messages_log')
      .select('customer_id')
      .eq('status', 'sent')
      .gte('created_at', todayStart);

    const alreadySentIds = new Set((alreadySentData || []).map((e: any) => e.customer_id));
    const alreadySentToday = alreadySentIds.size;

    const customersToMessage = todayBirthdays.filter(c => !excludedIds.has(c.id) && !alreadySentIds.has(c.id));
    console.log(`${customersToMessage.length} customers to send (${alreadySentToday} already sent today, ${excludedIds.size} excluded)`);

    const results = {
      total: customersToMessage.length,
      sent: 0,
      failed: 0,
      remaining: 0,
      alreadySentToday,
      errors: [] as { customer: string; error: string }[],
    };

    for (let i = 0; i < customersToMessage.length; i++) {
      // Time guardrail
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        results.remaining = customersToMessage.length - i;
        console.log(`⏳ Time guardrail reached after ${i} messages. ${results.remaining} remaining.`);
        break;
      }

      const customer = customersToMessage[i];
      try {
        console.log(`[${i + 1}/${customersToMessage.length}] Sending to ${customer.name}`);
        const chatguruResponse = await sendBirthdayViaDialog(customer.phone!, customer.name);

        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada via ChatGuru (template) para ${customer.name}`,
          status: 'sent',
          chatguru_message_id: chatguruResponse.messageId || null,
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

      // Throttle between messages (except last)
      if (i < customersToMessage.length - 1 && Date.now() - startTime < MAX_EXECUTION_MS) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));
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
