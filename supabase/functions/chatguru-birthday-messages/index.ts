import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian phone validation regex: country code (55) + DDD (2 digits, 11-99) + number (8-9 digits)
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

interface Customer {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
}

// Map internal errors to safe user-facing messages
function getSafeErrorMessage(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Map known errors to safe messages
  if (errorMessage.includes('telefone inválido') || errorMessage.includes('formato')) {
    return 'Número de telefone inválido';
  }
  if (errorMessage.includes('ChatGuru') || errorMessage.includes('API') || errorMessage.includes('comunicação')) {
    return 'Erro ao enviar mensagem';
  }
  if (errorMessage.includes('credentials') || errorMessage.includes('Credenciais')) {
    return 'Sistema de mensagens não configurado';
  }
  
  // Default safe message
  return 'Erro ao processar solicitação';
}

function validateBrazilianPhone(phone: string): string {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Add country code if not present
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  
  // Validate against Brazilian phone format
  if (!BRAZILIAN_PHONE_REGEX.test(fullPhone)) {
    throw new Error(`Número de telefone com formato inválido: esperado formato brasileiro (DDD + número)`);
  }
  
  return fullPhone;
}

async function setChatStatusToAttending(phone: string) {
  console.log(`Setting chat status to "em atendimento" for ${phone}`);

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
    console.log('ChatGuru chat_edit (status) response:', responseText);
    
    const data = JSON.parse(responseText);
    if (data.result === 'success') {
      console.log('Chat status changed to "em atendimento" successfully');
      return true;
    }
    console.warn('Failed to change chat status:', data);
    return false;
  } catch (error) {
    console.error('Error changing chat status:', error);
    return false;
  }
}

async function sendWhatsAppMessage(phone: string, customerName: string) {
  console.log(`Sending birthday message to ${phone} for ${customerName}`);
  
  // Validate and format phone number
  const fullPhone = validateBrazilianPhone(phone);
  
  console.log(`Formatted phone number: ${fullPhone}`);
  console.log(`Using API Key: ${CHATGURU_API_KEY?.substring(0, 8)}...`);
  console.log(`Using Account ID: ${CHATGURU_ACCOUNT_ID}`);
  console.log(`Using Phone ID: ${CHATGURU_PHONE_ID}`);
  
  const DIALOG_ID = '6977a8b42fc8f7656b256f9b';
  
  // Primeiro, tentar dialog_execute (para chats existentes)
  console.log('Attempting dialog_execute for existing chat...');
  const dialogParams = new URLSearchParams({
    key: CHATGURU_API_KEY!,
    account_id: CHATGURU_ACCOUNT_ID!,
    phone_id: CHATGURU_PHONE_ID!,
    action: 'dialog_execute',
    chat_number: fullPhone,
    dialog_id: DIALOG_ID,
  });
  
  const dialogUrl = `https://s17.chatguru.app/api/v1?${dialogParams.toString()}`;
  console.log('Dialog ID:', DIALOG_ID);
  console.log('Full URL (redacted key):', dialogUrl.replace(CHATGURU_API_KEY!, 'REDACTED'));
  
  const dialogResponse = await fetch(dialogUrl, { method: 'POST' });
  const dialogResponseText = await dialogResponse.text();
  console.log('ChatGuru dialog_execute response:', dialogResponseText);
  
  let dialogData;
  try {
    dialogData = JSON.parse(dialogResponseText);
  } catch (e) {
    console.error('Failed to parse dialog response as JSON:', dialogResponseText.substring(0, 200));
    throw new Error('Erro de comunicação com serviço de mensagens');
  }
  
  // Se dialog_execute funcionou, alterar status para "em atendimento"
  if (dialogData.result === 'success') {
    console.log('Message sent successfully via dialog_execute');
    await setChatStatusToAttending(fullPhone);
    return dialogData;
  }
  
  // Se o erro for "Chat não encontrado", tentar chat_add com dialog_id
  // Para WABA, o parâmetro 'text' deve conter o identificador do template
  if (dialogData.description?.includes('Chat não encontrado') || dialogData.code === 400) {
    console.log('Chat not found, attempting chat_add with dialog_id and template text...');
    
    // Para WABA/API oficial do WhatsApp, usar o nome do template como texto inicial
    // O template "aniversario" está aprovado pela Meta
    const chatAddParams = new URLSearchParams({
      key: CHATGURU_API_KEY!,
      account_id: CHATGURU_ACCOUNT_ID!,
      phone_id: CHATGURU_PHONE_ID!,
      action: 'chat_add',
      chat_number: fullPhone,
      name: customerName,
      text: 'aniversario', // Nome do template WABA aprovado pela Meta
      dialog_id: DIALOG_ID,
    });
    
    const chatAddUrl = `https://s17.chatguru.app/api/v1?${chatAddParams.toString()}`;
    console.log('Calling chat_add with dialog_id and text=aniversario...');
    console.log('Full URL (redacted key):', chatAddUrl.replace(CHATGURU_API_KEY!, 'REDACTED'));
    
    const chatAddResponse = await fetch(chatAddUrl, { method: 'POST' });
    const chatAddResponseText = await chatAddResponse.text();
    console.log('ChatGuru chat_add response:', chatAddResponseText);
    
    let chatAddData;
    try {
      chatAddData = JSON.parse(chatAddResponseText);
    } catch (e) {
      console.error('Failed to parse chat_add response as JSON:', chatAddResponseText.substring(0, 200));
      throw new Error('Erro de comunicação com serviço de mensagens');
    }
    
    if (chatAddData.result === 'success') {
      console.log('Chat created and dialog scheduled successfully');
      await setChatStatusToAttending(fullPhone);
      return chatAddData;
    }
    
    console.error('ChatGuru chat_add error:', chatAddData);
    throw new Error('Falha ao criar conversa no WhatsApp');
  }
  
  console.error('ChatGuru API error:', dialogData);
  throw new Error('Falha ao enviar mensagem via WhatsApp');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting birthday message automation...');

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Acesso restrito - apenas administradores podem executar esta função' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verification passed for user:', user.id);

    // Verify credentials
    if (!CHATGURU_API_KEY || !CHATGURU_ACCOUNT_ID || !CHATGURU_PHONE_ID) {
      console.error('Missing credentials:');
      console.error('- API_KEY:', CHATGURU_API_KEY ? 'SET' : 'MISSING');
      console.error('- ACCOUNT_ID:', CHATGURU_ACCOUNT_ID ? 'SET' : 'MISSING');
      console.error('- PHONE_ID:', CHATGURU_PHONE_ID ? 'SET' : 'MISSING');
      throw new Error('ChatGuru credentials not configured');
    }
    
    console.log('ChatGuru credentials verified');
    console.log(`API Key starts with: ${CHATGURU_API_KEY.substring(0, 8)}...`);
    console.log(`Account ID: ${CHATGURU_ACCOUNT_ID}`);
    console.log(`Phone ID: ${CHATGURU_PHONE_ID}`);

    // Get today's date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();

    console.log(`Checking birthdays for: ${currentDay}/${currentMonth + 1}`);

    // Fetch customer birthdays from Advbox - pass the user token for authentication
    const { data: birthdayData, error: birthdayError } = await supabase.functions.invoke(
      'advbox-integration/customer-birthdays',
      {
        body: { force_refresh: false },
        headers: {
          Authorization: authHeader,
        },
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

    // Normalize and filter customers with birthdays today
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
        const birthDay = birthday.getDate();
        const birthMonth = birthday.getMonth();

        if (birthDay !== currentDay || birthMonth !== currentMonth) {
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
    const { data: exclusions, error: exclusionsError } = await supabase
      .from('customer_birthday_exclusions')
      .select('customer_id');

    if (exclusionsError) {
      console.error('Error fetching exclusions:', exclusionsError);
      throw exclusionsError;
    }

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

    // Send messages
    for (const customer of customersToMessage) {
      try {
        console.log(`Sending birthday message to ${customer.name} (${customer.phone})`);

        const chatGuruResponse = await sendWhatsAppMessage(customer.phone!, customer.name);

        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada para ${customer.name}`,
          status: 'sent',
          chatguru_message_id: chatGuruResponse?.message_id || null,
        });

        results.sent++;
        console.log(`✓ Message sent successfully to ${customer.name}`);

        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: unknown) {
        const safeError = getSafeErrorMessage(error);
        console.error(`✗ Failed to send to ${customer.name}:`, error instanceof Error ? error.message : String(error));
        
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!,
          message_text: `Falha no envio para ${customer.name}`,
          status: 'failed',
          error_message: safeError, // Store safe error message, not raw error
        });

        results.failed++;
        results.errors.push({
          customer: customer.name,
          error: safeError, // Return safe error message to client
        });
      }
    }

    console.log('Birthday message automation completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automação de mensagens de aniversário concluída',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in birthday messages automation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: getSafeErrorMessage(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
