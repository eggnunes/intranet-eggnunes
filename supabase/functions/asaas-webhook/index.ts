import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

interface AsaasPaymentData {
  id: string;
  customer: string;
  installment?: string;
  subscription?: string;
  value: number;
  netValue?: number;
  originalValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  confirmedDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeId?: string;
  nossoNumero?: string;
  clientPaymentDate?: string;
}

interface AsaasWebhookPayload {
  event: string;
  payment?: AsaasPaymentData;
  transfer?: {
    id: string;
    value: number;
    status: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Asaas Webhook received');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

    // Verificar token do webhook (opcional, mas recomendado)
    const authToken = req.headers.get('asaas-access-token');
    if (ASAAS_WEBHOOK_TOKEN && authToken !== ASAAS_WEBHOOK_TOKEN) {
      console.error('Token de webhook inválido');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

    const payload: AsaasWebhookPayload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const { event, payment, transfer } = payload;

    // Salvar evento no log
    const { data: eventLog, error: logError } = await supabase
      .from('asaas_webhook_events')
      .insert({
        event_type: event,
        payment_id: payment?.id,
        installment_id: payment?.installment,
        customer_id: payment?.customer,
        subscription_id: payment?.subscription,
        transfer_id: transfer?.id,
        event_data: payload,
        processed: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Erro ao salvar log do evento:', logError);
    } else {
      console.log('Evento salvo no log:', eventLog?.id);
    }

    // Processar eventos de pagamento
    if (payment) {
      try {
        await processPaymentEvent(supabase, event, payment);
        
        // Marcar como processado
        if (eventLog) {
          await supabase
            .from('asaas_webhook_events')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', eventLog.id);
        }
      } catch (processError) {
        console.error('Erro ao processar evento:', processError);
        
        // Registrar erro
        if (eventLog) {
          await supabase
            .from('asaas_webhook_events')
            .update({ 
              error_message: processError instanceof Error ? processError.message : 'Erro desconhecido'
            })
            .eq('id', eventLog.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro no webhook Asaas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPaymentEvent(
  supabase: any,
  event: string,
  payment: AsaasPaymentData
) {
  console.log(`Processando evento ${event} para pagamento ${payment.id}`);

  // Buscar link existente
  const { data: existingLinks } = await supabase
    .from('asaas_payment_links')
    .select('*')
    .eq('asaas_payment_id', payment.id)
    .limit(1);

  const existingLink = existingLinks && existingLinks.length > 0 ? existingLinks[0] : null;

  const paymentLinkData = {
    asaas_payment_id: payment.id,
    asaas_installment_id: payment.installment || null,
    asaas_customer_id: payment.customer,
    value: payment.value,
    due_date: payment.dueDate,
    payment_date: payment.paymentDate || payment.confirmedDate || null,
    status: payment.status,
    billing_type: payment.billingType,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    updated_at: new Date().toISOString(),
  };

  if (existingLink) {
    // Atualizar link existente
    await supabase
      .from('asaas_payment_links')
      .update(paymentLinkData)
      .eq('id', existingLink.id);
    
    console.log(`Link de pagamento atualizado: ${existingLink.id}`);

    // Se o pagamento foi confirmado e há um lançamento vinculado, atualizar status
    if (
      (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') &&
      existingLink.lancamento_id
    ) {
      await updateLancamentoStatus(supabase, existingLink.lancamento_id, payment);
    }
  } else {
    // Criar novo link
    const { data: newLinks, error } = await supabase
      .from('asaas_payment_links')
      .insert({
        ...paymentLinkData,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Erro ao criar link de pagamento:', error);
    } else if (newLinks && newLinks.length > 0) {
      console.log(`Novo link de pagamento criado: ${newLinks[0].id}`);
    }

    // Tentar vincular automaticamente por externalReference
    if (payment.externalReference) {
      await tryAutoLink(supabase, payment);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateLancamentoStatus(
  supabase: any,
  lancamentoId: string,
  payment: AsaasPaymentData
) {
  console.log(`Atualizando status do lançamento ${lancamentoId}`);

  const { error } = await supabase
    .from('fin_lancamentos')
    .update({
      status: 'pago',
      data_pagamento: payment.paymentDate || payment.confirmedDate || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
      observacoes: `Pagamento confirmado via Asaas (${payment.billingType}) em ${new Date().toLocaleString('pt-BR')}`,
    })
    .eq('id', lancamentoId);

  if (error) {
    console.error('Erro ao atualizar lançamento:', error);
    throw error;
  }

  console.log(`Lançamento ${lancamentoId} marcado como pago`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryAutoLink(
  supabase: any,
  payment: AsaasPaymentData
) {
  if (!payment.externalReference) return;

  console.log(`Tentando vincular pagamento ${payment.id} com referência externa ${payment.externalReference}`);

  // Tentar encontrar lançamento pelo ID
  const { data: lancamentos } = await supabase
    .from('fin_lancamentos')
    .select('id')
    .eq('id', payment.externalReference)
    .limit(1);

  if (lancamentos && lancamentos.length > 0) {
    const lancamento = lancamentos[0];
    // Atualizar link com o lançamento encontrado
    await supabase
      .from('asaas_payment_links')
      .update({ lancamento_id: lancamento.id })
      .eq('asaas_payment_id', payment.id);

    console.log(`Pagamento ${payment.id} vinculado ao lançamento ${lancamento.id}`);
  }
}
