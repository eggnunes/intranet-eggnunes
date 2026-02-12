import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Dialog ID do template de aniversário aprovado pela Meta no ChatGuru
const BIRTHDAY_DIALOG_ID = '6977a8b42fc8f7656b256f9b';

// Brazilian phone validation regex: country code (55) + DDD (2 digits, 11-99) + number (8-9 digits)
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

// Interval between messages: 3 minutes (180000ms)
const BULK_INTERVAL_MS = 3 * 60 * 1000;

interface Customer {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
}

function getSafeErrorMessage(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('telefone inválido') || errorMessage.includes('formato')) {
    return 'Número de telefone inválido';
  }
  if (errorMessage.includes('ChatGuru') || errorMessage.includes('API') || errorMessage.includes('comunicação')) {
    return 'Erro ao enviar mensagem';
  }
  if (errorMessage.includes('credentials') || errorMessage.includes('Credenciais')) {
    return 'Sistema de mensagens não configurado';
  }
  return 'Erro ao processar solicitação';
}

function validateBrazilianPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: esperado formato brasileiro (DDD + número)`);
  }
  return fullPhone;
}

async function setChatStatusToAttending(phone: string): Promise<boolean> {
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

  console.log(`[ChatGuru] Setting chat status to "em atendimento" for ${phone}`);

  const params = new URLSearchParams({
    key: CHATGURU_API_KEY!,
    account_id: CHATGURU_ACCOUNT_ID!,
    phone_id: CHATGURU_PHONE_ID!,
    action: 'chat_edit',
    chat_number: phone,
    status: 'em atendimento',
  });

  const url = `https://s17.chatguru.app/api/v1?${params.toString()}`;

  try {
    const response = await fetch(url, { method: 'POST' });
    const responseText = await response.text();
    console.log('[ChatGuru] chat_edit (status) response:', responseText);

    const data = JSON.parse(responseText);
    if (data.result === 'success') {
      console.log('[ChatGuru] Chat status changed to "em atendimento" successfully');
      return true;
    }
    console.warn('[ChatGuru] Failed to change chat status:', data);
    return false;
  } catch (error) {
    console.error('[ChatGuru] Error changing chat status:', error);
    return false;
  }
}

async function sendBirthdayViaDialog(phone: string, customerName: string): Promise<{ messageId?: string; success: boolean }> {
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

  if (!CHATGURU_API_KEY || !CHATGURU_ACCOUNT_ID || !CHATGURU_PHONE_ID) {
    throw new Error('Credenciais do ChatGuru não configuradas');
  }

  const fullPhone = validateBrazilianPhone(phone);
  console.log(`[ChatGuru] Sending birthday dialog to ${fullPhone} for ${customerName} (dialog_id: ${BIRTHDAY_DIALOG_ID})`);

  // Step 1: Try dialog_execute for existing chats
  console.log('[ChatGuru] Attempting dialog_execute for existing chat...');
  const dialogParams = new URLSearchParams({
    key: CHATGURU_API_KEY,
    account_id: CHATGURU_ACCOUNT_ID,
    phone_id: CHATGURU_PHONE_ID,
    action: 'dialog_execute',
    chat_number: fullPhone,
    dialog_id: BIRTHDAY_DIALOG_ID,
  });

  const dialogUrl = `https://s17.chatguru.app/api/v1?${dialogParams.toString()}`;
  console.log('[ChatGuru] Full URL (redacted key):', dialogUrl.replace(CHATGURU_API_KEY, 'REDACTED'));

  const dialogResponse = await fetch(dialogUrl, { method: 'POST' });
  const dialogResponseText = await dialogResponse.text();
  console.log('[ChatGuru] dialog_execute response:', dialogResponseText);

  let dialogData;
  try {
    dialogData = JSON.parse(dialogResponseText);
  } catch {
    console.error('[ChatGuru] Failed to parse dialog response:', dialogResponseText.substring(0, 200));
    throw new Error('Erro de comunicação com serviço de mensagens');
  }

  if (dialogData.result === 'success') {
    console.log('[ChatGuru] Message sent successfully via dialog_execute');
    await setChatStatusToAttending(fullPhone);
    return { messageId: dialogData.message_id, success: true };
  }

  // Step 2: If chat not found, try chat_add with dialog_id
  if (dialogData.description?.includes('Chat não encontrado') || dialogData.code === 400) {
    console.log('[ChatGuru] Chat not found, attempting chat_add with dialog_id...');

    const chatAddParams = new URLSearchParams({
      key: CHATGURU_API_KEY,
      account_id: CHATGURU_ACCOUNT_ID,
      phone_id: CHATGURU_PHONE_ID,
      action: 'chat_add',
      chat_number: fullPhone,
      name: customerName,
      text: 'aniversario_cliente',
      dialog_id: BIRTHDAY_DIALOG_ID,
    });

    const chatAddUrl = `https://s17.chatguru.app/api/v1?${chatAddParams.toString()}`;
    console.log('[ChatGuru] chat_add URL (redacted key):', chatAddUrl.replace(CHATGURU_API_KEY, 'REDACTED'));

    const chatAddResponse = await fetch(chatAddUrl, { method: 'POST' });
    const chatAddResponseText = await chatAddResponse.text();
    console.log('[ChatGuru] chat_add response:', chatAddResponseText);

    let chatAddData;
    try {
      chatAddData = JSON.parse(chatAddResponseText);
    } catch {
      console.error('[ChatGuru] Failed to parse chat_add response:', chatAddResponseText.substring(0, 200));
      throw new Error('Erro de comunicação com serviço de mensagens');
    }

    if (chatAddData.result === 'success') {
      console.log('[ChatGuru] Chat created and dialog scheduled successfully');
      await setChatStatusToAttending(fullPhone);
      return { messageId: chatAddData.message_id, success: true };
    }

    console.error('[ChatGuru] chat_add error:', chatAddData);
    throw new Error('Falha ao criar conversa no WhatsApp');
  }

  console.error('[ChatGuru] API error:', dialogData);
  throw new Error('Falha ao enviar mensagem via WhatsApp');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting birthday message automation via ChatGuru...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated and is an admin
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

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Acesso restrito - apenas administradores podem executar esta função' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verification passed for user:', user.id);

    // Verify ChatGuru credentials
    const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
    const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
    const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

    if (!CHATGURU_API_KEY || !CHATGURU_ACCOUNT_ID || !CHATGURU_PHONE_ID) {
      throw new Error('Credenciais do ChatGuru não configuradas');
    }
    console.log('[ChatGuru] Credentials verified');

    // Get today's date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    console.log(`Checking birthdays for: ${currentDay}/${currentMonth + 1}`);

    // Fetch customer birthdays from Advbox
    const { data: birthdayData, error: birthdayError } = await supabase.functions.invoke(
      'advbox-integration/customer-birthdays',
      {
        body: { force_refresh: false },
        headers: { Authorization: authHeader },
      }
    );

    if (birthdayError) {
      console.error('Error fetching birthdays:', birthdayError);
      throw birthdayError;
    }

    // Handle nested data structure from Advbox API
    let rawCustomers: any[] = [];
    if (Array.isArray(birthdayData)) {
      rawCustomers = birthdayData;
    } else if (birthdayData?.data?.data && Array.isArray(birthdayData.data.data)) {
      rawCustomers = birthdayData.data.data;
    } else if (birthdayData?.data && Array.isArray(birthdayData.data)) {
      rawCustomers = birthdayData.data;
    } else if (birthdayData && typeof birthdayData === 'object') {
      for (const key of Object.keys(birthdayData)) {
        if (Array.isArray(birthdayData[key])) {
          rawCustomers = birthdayData[key];
          break;
        }
      }
    }
    
    console.log(`Found ${rawCustomers.length} total customers with birthdays`);

    // Filter customers with birthdays today
    const todayBirthdays: Customer[] = rawCustomers
      .map((c) => {
        let birthdayIso = '';
        const rawBirth = c.birthdate || c.birthday;

        if (rawBirth) {
          const parts = String(rawBirth).split(/[\/\-]/);
          if (parts.length === 3) {
            const [day, month, year] = parts;
            const date = new Date(Number(year), Number(month) - 1, Number(day));
            if (!isNaN(date.getTime())) {
              birthdayIso = date.toISOString();
            }
          }
        }

        if (!birthdayIso) return null;

        const birthday = new Date(birthdayIso);
        if (birthday.getDate() !== currentDay || birthday.getMonth() !== currentMonth) {
          return null;
        }

        return {
          id: String(c.id ?? c.customer_id ?? ''),
          name: c.name ?? '',
          phone: c.phone ?? c.cellphone ?? undefined,
          birthday: birthdayIso,
        } as Customer;
      })
      .filter((c): c is Customer => c !== null && !!c.phone);

    console.log(`Found ${todayBirthdays.length} customers with birthdays today`);

    // Fetch exclusions
    const { data: exclusions } = await supabase
      .from('customer_birthday_exclusions')
      .select('customer_id');

    const excludedIds = new Set((exclusions || []).map((e: any) => e.customer_id));
    console.log(`Found ${excludedIds.size} excluded customers`);

    const customersToMessage = todayBirthdays.filter(c => !excludedIds.has(c.id));
    console.log(`${customersToMessage.length} customers to send messages to`);

    const results = {
      total: customersToMessage.length,
      sent: 0,
      failed: 0,
      errors: [] as { customer: string; error: string }[],
    };

    // Send messages with 3-minute intervals
    for (let i = 0; i < customersToMessage.length; i++) {
      const customer = customersToMessage[i];
      try {
        console.log(`[${i + 1}/${customersToMessage.length}] Sending birthday message to ${customer.name} (${customer.phone})`);

        const chatguruResponse = await sendBirthdayViaDialog(customer.phone!, customer.name);

        // Log in birthday log table
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada via ChatGuru (template) para ${customer.name}`,
          status: 'sent',
          chatguru_message_id: chatguruResponse.messageId || null,
        });

        results.sent++;
        console.log(`✓ Message sent successfully to ${customer.name}`);

        // Wait 3 minutes between messages (except the last one)
        if (i < customersToMessage.length - 1) {
          console.log(`⏳ Waiting 3 minutes before sending next message...`);
          await new Promise(resolve => setTimeout(resolve, BULK_INTERVAL_MS));
        }
      } catch (error: unknown) {
        const safeError = getSafeErrorMessage(error);
        console.error(`✗ Failed to send to ${customer.name}:`, error instanceof Error ? error.message : String(error));
        
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

        // Still wait between messages even on failure
        if (i < customersToMessage.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BULK_INTERVAL_MS));
        }
      }
    }

    console.log('Birthday message automation completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automação de mensagens de aniversário concluída (via ChatGuru)',
        results,
      }),
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
