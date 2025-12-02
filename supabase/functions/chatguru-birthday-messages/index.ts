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

async function sendWhatsAppMessage(phone: string, customerName: string) {
  console.log(`Sending birthday message to ${phone} for ${customerName}`);
  
  // Remove formatting from phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verificar se o telefone é válido (deve ter 10 ou 11 dígitos)
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    throw new Error('Número de telefone inválido');
  }
  
  // Adiciona código do país se não tiver
  const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  
  // Mensagem de aniversário personalizada
  const birthdayMessage = `Olá ${customerName}! 🎂\n\nA equipe Egg Nunes Advogados deseja a você um feliz aniversário! Que seu dia seja repleto de alegrias e realizações.\n\nUm forte abraço!`;
  
  // Primeiro, tentar cadastrar o chat com a mensagem inicial usando chat_add
  // Isso permite enviar para contatos que não estão previamente cadastrados no ChatGuru
  const chatAddParams = new URLSearchParams({
    key: CHATGURU_API_KEY!,
    account_id: CHATGURU_ACCOUNT_ID!,
    phone_id: CHATGURU_PHONE_ID!,
    action: 'chat_add',
    chat_number: fullPhone,
    name: customerName,
    text: birthdayMessage,
  });
  
  const chatAddUrl = `https://app.zap.guru/api/v1?${chatAddParams.toString()}`;
  console.log('Calling ChatGuru API (chat_add)...');
  
  const chatAddResponse = await fetch(chatAddUrl, {
    method: 'POST',
  });

  const chatAddData = await chatAddResponse.json();
  console.log('ChatGuru chat_add response:', JSON.stringify(chatAddData));
  
  // Se chat_add funcionar, retornar sucesso
  if (chatAddData.result === 'success') {
    console.log('Chat added and message sent successfully via chat_add');
    return chatAddData;
  }
  
  // Se o chat já existir, tentar enviar mensagem diretamente com message_send
  console.log('Trying message_send as fallback...');
  
  const messageSendParams = new URLSearchParams({
    key: CHATGURU_API_KEY!,
    account_id: CHATGURU_ACCOUNT_ID!,
    phone_id: CHATGURU_PHONE_ID!,
    action: 'message_send',
    chat_number: fullPhone,
    text: birthdayMessage,
  });
  
  const messageSendUrl = `https://app.zap.guru/api/v1?${messageSendParams.toString()}`;
  console.log('Calling ChatGuru API (message_send)...');
  
  const messageSendResponse = await fetch(messageSendUrl, {
    method: 'POST',
  });

  const messageSendData = await messageSendResponse.json();
  console.log('ChatGuru message_send response:', JSON.stringify(messageSendData));
  
  if (messageSendData.result === 'error' || messageSendData.code >= 400) {
    throw new Error(`ChatGuru API error: ${messageSendData.description || chatAddData.description || JSON.stringify(messageSendData)}`);
  }

  console.log('Message sent successfully via message_send');
  return messageSendData;
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
      throw new Error('ChatGuru credentials not configured');
    }

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

    // Debug: log the structure of birthdayData
    console.log('birthdayData type:', typeof birthdayData);
    console.log('birthdayData keys:', birthdayData ? Object.keys(birthdayData) : 'null');
    
    // Handle nested data structure from Advbox API
    let rawCustomers: any[] = [];
    if (Array.isArray(birthdayData)) {
      rawCustomers = birthdayData;
    } else if (birthdayData?.data?.data && Array.isArray(birthdayData.data.data)) {
      rawCustomers = birthdayData.data.data;
    } else if (birthdayData?.data && Array.isArray(birthdayData.data)) {
      rawCustomers = birthdayData.data;
    } else if (birthdayData && typeof birthdayData === 'object') {
      // Try to find an array property
      for (const key of Object.keys(birthdayData)) {
        if (Array.isArray(birthdayData[key])) {
          rawCustomers = birthdayData[key];
          console.log(`Found array in birthdayData.${key}`);
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

        // Check if birthday is today
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

    // Filter out excluded customers
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

        // Log successful send
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

        // Delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`✗ Failed to send to ${customer.name}:`, error.message);
        
        // Log failed send
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
