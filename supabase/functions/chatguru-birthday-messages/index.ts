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
  console.log(`Sending birthday template message to ${phone} for ${customerName}`);
  
  // Remove formatting from phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  const url = `https://v1.nocodeapi.com/eggnunes/${CHATGURU_ACCOUNT_ID}/whatsapp/${CHATGURU_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: 'aniversario',
        language: {
          code: 'pt_BR',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: customerName,
              },
            ],
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ChatGuru API error:', errorText);
    throw new Error(`ChatGuru API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Template message sent successfully:', data);
  return data;
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
        console.log(`Sending birthday template to ${customer.name} (${customer.phone})`);

        const chatGuruResponse = await sendWhatsAppMessage(customer.phone!, customer.name);

        // Log successful send
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          message_text: `Template: aniversario - Nome: ${customer.name}`,
          status: 'sent',
          chatguru_message_id: chatGuruResponse?.message_id || null,
        });

        results.sent++;
        console.log(`✓ Template message sent successfully to ${customer.name}`);

        // Delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`✗ Failed to send template to ${customer.name}:`, error.message);
        
        // Log failed send
        await supabase.from('chatguru_birthday_messages_log').insert({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone!,
          message_text: `Template: aniversario - Nome: ${customer.name}`,
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
