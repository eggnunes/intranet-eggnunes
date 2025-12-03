import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Customer {
  id: string;
  name: string;
  phone?: string;
  birthday: string;
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
  
  // Remove formatting from phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verificar se o telefone é válido
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    throw new Error(`Número de telefone inválido: ${cleanPhone} (${cleanPhone.length} dígitos)`);
  }
  
  // Adiciona código do país se não tiver (número brasileiro)
  // Formato final: 5531999999999 (sem o +)
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  
  console.log(`Formatted phone number: ${fullPhone}`);
  console.log(`Using API Key: ${CHATGURU_API_KEY?.substring(0, 8)}...`);
  console.log(`Using Account ID: ${CHATGURU_ACCOUNT_ID}`);
  console.log(`Using Phone ID: ${CHATGURU_PHONE_ID}`);
  
  const DIALOG_ID = '679a5d753968d5272a54d203';
  
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
    throw new Error(`ChatGuru returned invalid response: ${dialogResponseText.substring(0, 100)}`);
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
      throw new Error(`ChatGuru chat_add returned invalid response: ${chatAddResponseText.substring(0, 100)}`);
    }
    
    if (chatAddData.result === 'success') {
      console.log('Chat created and dialog scheduled successfully');
      await setChatStatusToAttending(fullPhone);
      return chatAddData;
    }
    
    throw new Error(`ChatGuru chat_add error: ${chatAddData.description || JSON.stringify(chatAddData)}`);
  }
  
  throw new Error(`ChatGuru API error: ${dialogData.description || JSON.stringify(dialogData)}`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting birthday message automation...');

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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      errors: [] as any[],
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
      } catch (error: any) {
        console.error(`✗ Failed to send to ${customer.name}:`, error.message);
        
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!,
          message_text: `Falha no envio para ${customer.name}`,
          status: 'failed',
          error_message: error.message,
        });

        results.failed++;
        results.errors.push({
          customer: customer.name,
          error: error.message,
        });
      }
    }

    console.log('Birthday message automation completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Birthday messages automation completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in birthday messages automation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
