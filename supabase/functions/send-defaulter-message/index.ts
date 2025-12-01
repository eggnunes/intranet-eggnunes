import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template de mensagens por faixa de dias em atraso
const getMessageTemplate = (daysOverdue: number, customerName: string, amount: number): { templateName: string, text: string } => {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);

  if (daysOverdue <= 3) {
    return {
      templateName: 'inadimplencia_2_dias',
      text: `Olá ${customerName}, notamos que seu pagamento de ${formattedAmount} está com ${daysOverdue} dia(s) de atraso. Por favor, regularize sua situação o quanto antes. Caso já tenha efetuado o pagamento, desconsidere esta mensagem.`
    };
  } else if (daysOverdue <= 10) {
    return {
      templateName: 'inadimplencia_7_dias',
      text: `Prezado(a) ${customerName}, seu pagamento de ${formattedAmount} está com ${daysOverdue} dias de atraso. É importante regularizar essa pendência para evitar juros e multas adicionais. Entre em contato conosco caso tenha alguma dúvida.`
    };
  } else if (daysOverdue <= 20) {
    return {
      templateName: 'inadimplencia_15_dias',
      text: `Atenção ${customerName}! Seu débito de ${formattedAmount} está com ${daysOverdue} dias de atraso. Estamos à disposição para negociar formas de pagamento. Entre em contato urgentemente.`
    };
  } else if (daysOverdue <= 35) {
    return {
      templateName: 'inadimplencia_25_dias',
      text: `URGENTE - ${customerName}, sua dívida de ${formattedAmount} está ${daysOverdue} dias atrasada. Para evitar medidas judiciais, entre em contato imediatamente para negociação.`
    };
  } else {
    return {
      templateName: 'inadimplencia_40_dias',
      text: `ÚLTIMA NOTIFICAÇÃO - ${customerName}, seu débito de ${formattedAmount} está com ${daysOverdue} dias de atraso. Sem a regularização imediata, tomaremos medidas cabíveis. Contate-nos com urgência.`
    };
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { customerId, customerName, customerPhone, amount, daysOverdue } = await req.json();

    console.log('Sending defaulter message:', { customerId, customerName, customerPhone, amount, daysOverdue });

    // Verificar se o cliente está na lista de exclusões
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
          error: 'Cliente está na lista de exclusão e não receberá mensagens automáticas.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Normalizar telefone (remover caracteres especiais)
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    
    // Verificar se o telefone é válido (deve ter 10 ou 11 dígitos)
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw new Error('Número de telefone inválido');
    }

    // Obter template de mensagem baseado nos dias de atraso
    const { templateName, text } = getMessageTemplate(daysOverdue, customerName, amount);

    console.log('Using template:', templateName);

    // Enviar mensagem via ChatGuru
    const chatguruResponse = await fetch('https://api.chatguru.app/api/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CHATGURU_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: Deno.env.get('CHATGURU_ACCOUNT_ID'),
        phone_id: Deno.env.get('CHATGURU_PHONE_ID'),
        to: `55${normalizedPhone}`, // Adiciona código do Brasil
        type: 'text',
        text: {
          body: text
        }
      }),
    });

    if (!chatguruResponse.ok) {
      const errorData = await chatguruResponse.text();
      console.error('ChatGuru API error:', errorData);
      throw new Error(`Erro ao enviar mensagem: ${errorData}`);
    }

    const chatguruData = await chatguruResponse.json();
    console.log('ChatGuru response:', chatguruData);

    // Obter o usuário autenticado
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Registrar no log
    const { error: logError } = await supabase
      .from('defaulter_messages_log')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: normalizedPhone,
        days_overdue: daysOverdue,
        message_template: templateName,
        message_text: text,
        status: 'sent',
        chatguru_message_id: chatguruData.id || null,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });

    if (logError) {
      console.error('Error logging message:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: chatguruData.id,
        template: templateName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-defaulter-message function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});