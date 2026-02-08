import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_OFICIAL = '553132268742';
const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

// Brazilian phone validation regex
const BRAZILIAN_PHONE_REGEX = /^55[1-9][0-9]9?[0-9]{8}$/;

function getSafeErrorMessage(error: Error | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('telefone inválido') || errorMessage.includes('formato')) {
    return 'Número de telefone inválido. Verifique o formato.';
  }
  if (errorMessage.includes('Z-API') || errorMessage.includes('API')) {
    return 'Erro ao enviar mensagem. Tente novamente mais tarde.';
  }
  if (errorMessage.includes('Credenciais')) {
    return 'Sistema de mensagens não configurado. Contate o administrador.';
  }
  if (errorMessage.includes('exclusão')) {
    return errorMessage;
  }
  if (errorMessage.includes('autenticado')) {
    return 'Você precisa estar logado para realizar esta ação.';
  }
  return 'Erro ao processar solicitação. Tente novamente.';
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

async function sendCollectionMessageViaZAPI(phone: string, customerName: string, amount: number, daysOverdue: number): Promise<{ zaapId?: string; success: boolean }> {
  const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
  const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
  const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

  console.log(`[Z-API] Credentials debug - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN.length}, Client Token length: ${ZAPI_CLIENT_TOKEN.length}`);

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    throw new Error('Credenciais da Z-API não configuradas');
  }

  const fullPhone = validateBrazilianPhone(phone);
  console.log(`[Z-API] Sending collection message to ${fullPhone} for ${customerName}`);

  const firstName = customerName.split(' ')[0];
  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  let collectionMessage = '';
  if (daysOverdue <= 3) {
    collectionMessage = `Olá, *${firstName}*! 👋\n\nEste é um lembrete amigável do escritório *Egg Nunes Advogados Associados*.\n\nIdentificamos um pagamento no valor de *${formattedAmount}* que está com *${daysOverdue} dia(s) em atraso*.\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Caso contrário, pedimos a gentileza de regularizar o quanto antes.\n\nAgradecemos a compreensão! 🙏`;
  } else if (daysOverdue <= 15) {
    collectionMessage = `Olá, *${firstName}*! 👋\n\nGostaríamos de informar que consta em nosso sistema um pagamento pendente no valor de *${formattedAmount}*, com *${daysOverdue} dias em atraso*.\n\nPedimos a gentileza de providenciar a regularização o mais breve possível para evitar demais encargos.\n\nCaso tenha alguma dúvida ou dificuldade, entre em contato conosco pelos nossos canais oficiais.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;
  } else {
    collectionMessage = `Prezado(a) *${firstName}*,\n\nInformamos que consta em nosso sistema uma pendência financeira no valor de *${formattedAmount}*, com *${daysOverdue} dias em atraso*.\n\nSolicitamos a regularização urgente desta pendência.\n\nPara tratar sobre esta questão, entre em contato conosco através dos nossos canais oficiais.\n\nAtenciosamente,\n*Egg Nunes Advogados Associados*`;
  }

  // Append footer
  collectionMessage += FOOTER_AVISO;

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone: fullPhone,
      message: collectionMessage,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { customerId, customerName, customerPhone, amount, daysOverdue } = await req.json();
    console.log('[Z-API] Sending defaulter message:', { customerId, customerName, customerPhone, amount, daysOverdue });

    // Verify Z-API credentials
    const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
    const ZAPI_TOKEN = (Deno.env.get('ZAPI_TOKEN') || '').trim();
    const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Credenciais da Z-API não configuradas');
    }

    // Check exclusion list
    const { data: exclusion } = await supabase
      .from('defaulter_exclusions')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (exclusion) {
      console.log('Customer is in exclusion list, skipping message');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cliente está na lista de exclusão e não receberá mensagens de cobrança.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send message via Z-API
    const zapiResponse = await sendCollectionMessageViaZAPI(customerPhone, customerName, amount, daysOverdue);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Acesso restrito - apenas administradores podem enviar mensagens de cobrança.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log in defaulter messages log
    await supabase
      .from('defaulter_messages_log')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone.replace(/\D/g, ''),
        days_overdue: daysOverdue,
        message_template: 'zapi-collection',
        message_text: `Z-API | Cliente: ${customerName} | Valor: R$ ${amount} | Dias em atraso: ${daysOverdue}`,
        status: 'sent',
        chatguru_message_id: zapiResponse.zaapId || null,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });

    // Also log in Z-API log table
    await supabase.from('zapi_messages_log').insert({
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone.replace(/\D/g, ''),
      message_text: `Cobrança - ${customerName} - R$ ${amount} - ${daysOverdue} dias em atraso`,
      message_type: 'cobranca',
      status: 'sent',
      zapi_message_id: zapiResponse.zaapId || null,
      sent_by: user.id,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: zapiResponse.zaapId,
        provider: 'z-api',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Z-API] Error in send-defaulter-message:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: getSafeErrorMessage(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
