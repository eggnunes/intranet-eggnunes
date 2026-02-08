import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian phone validation regex: country code (55) + DDD (2 digits, 11-99) + number (8-9 digits)
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

const WHATSAPP_OFICIAL = '553132268742';
const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

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
  if (errorMessage.includes('Z-API') || errorMessage.includes('API') || errorMessage.includes('comunicação')) {
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

async function sendWhatsAppMessageViaZAPI(phone: string, customerName: string): Promise<{ zaapId?: string; success: boolean }> {
  const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
  const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
  const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

  console.log(`[Z-API] Credentials debug - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}, Client Token length: ${ZAPI_CLIENT_TOKEN.length}`);

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const fullPhone = validateBrazilianPhone(phone);
  console.log(`[Z-API] Sending birthday message to ${fullPhone} for ${customerName}`);

  // Build birthday message
  const firstName = customerName.split(' ')[0];
  const birthdayMessage = `🎂 *Feliz Aniversário, ${firstName}!* 🎉\n\nO escritório *Egg Nunes Advogados Associados* deseja a você um dia repleto de alegrias, realizações e muita saúde!\n\nQue este novo ciclo traga conquistas incríveis. Parabéns! 🥳` + FOOTER_AVISO;

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone: fullPhone,
      message: birthdayMessage,
    }),
  });

  const responseText = await response.text();
  console.log(`[Z-API] Response status: ${response.status}, body: ${responseText}`);

  if (!response.ok) {
    throw new Error(`Z-API error (${response.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Erro de comunicação com serviço de mensagens');
  }

  return { zaapId: data.zaapId || data.messageId, success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting birthday message automation via Z-API...');

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

    // Verify Z-API credentials
    const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
    const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
    const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Credenciais da Z-API não configuradas');
    }
    console.log('[Z-API] Credentials verified');

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

        const zapiResponse = await sendWhatsAppMessageViaZAPI(customer.phone!, customer.name);

        // Log in birthday log table
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Mensagem de aniversário enviada via Z-API para ${customer.name}`,
          status: 'sent',
          chatguru_message_id: zapiResponse.zaapId || null,
        });

        // Also log in Z-API log table
        await supabase.from('zapi_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!.replace(/\D/g, ''),
          message_text: `Mensagem de aniversário para ${customer.name}`,
          message_type: 'aniversario',
          status: 'sent',
          zapi_message_id: zapiResponse.zaapId || null,
          sent_by: user.id,
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

        await supabase.from('zapi_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!.replace(/\D/g, ''),
          message_text: `Falha no envio de aniversário para ${customer.name}`,
          message_type: 'aniversario',
          status: 'failed',
          error_message: safeError,
          sent_by: user.id,
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
        message: 'Automação de mensagens de aniversário concluída (via Z-API)',
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
