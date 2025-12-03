import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dialog ID do template "cobrancadocumentosparaacao" aprovado pela Meta
const DIALOG_ID = '679a5d763968d5272a54d22b';
const TEMPLATE_NAME = 'cobrancadocumentosparaacao';

async function setChatStatusToAttending(phone: string) {
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

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
  const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
  const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
  const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

  console.log(`Sending document request message to ${phone} for ${customerName}`);
  
  // Remove formatting from phone number
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verificar se o telefone é válido
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    throw new Error(`Número de telefone inválido: ${cleanPhone} (${cleanPhone.length} dígitos)`);
  }
  
  // Adiciona código do país se não tiver (número brasileiro)
  let fullPhone = cleanPhone;
  if (cleanPhone.length <= 11) {
    fullPhone = `55${cleanPhone}`;
  }
  
  console.log(`Formatted phone number: ${fullPhone}`);
  console.log(`Using Dialog ID: ${DIALOG_ID}`);
  
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
  if (dialogData.description?.includes('Chat não encontrado') || dialogData.code === 400) {
    console.log('Chat not found, attempting chat_add with dialog_id and template text...');
    
    // Para WABA/API oficial do WhatsApp, usar o nome do template como texto inicial
    const chatAddParams = new URLSearchParams({
      key: CHATGURU_API_KEY!,
      account_id: CHATGURU_ACCOUNT_ID!,
      phone_id: CHATGURU_PHONE_ID!,
      action: 'chat_add',
      chat_number: fullPhone,
      name: customerName,
      text: TEMPLATE_NAME, // Nome do template WABA aprovado pela Meta
      dialog_id: DIALOG_ID,
    });
    
    const chatAddUrl = `https://s17.chatguru.app/api/v1?${chatAddParams.toString()}`;
    console.log('Calling chat_add with dialog_id and text=' + TEMPLATE_NAME + '...');
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

    const { customerId, customerName, customerPhone, processNumber, processId } = await req.json();

    console.log('Sending document request message:', { customerId, customerName, customerPhone, processNumber, processId });

    // Verificar credenciais
    const CHATGURU_API_KEY = Deno.env.get('CHATGURU_API_KEY');
    const CHATGURU_ACCOUNT_ID = Deno.env.get('CHATGURU_ACCOUNT_ID');
    const CHATGURU_PHONE_ID = Deno.env.get('CHATGURU_PHONE_ID');

    if (!CHATGURU_API_KEY || !CHATGURU_ACCOUNT_ID || !CHATGURU_PHONE_ID) {
      throw new Error('Credenciais do ChatGuru não configuradas');
    }

    if (!customerPhone) {
      throw new Error('Cliente não possui telefone cadastrado');
    }

    // Enviar mensagem via ChatGuru
    const chatguruResponse = await sendWhatsAppMessage(customerPhone, customerName);

    // Obter o usuário autenticado
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Registrar no log (usando a tabela existente de mensagens de cobrança)
    const { error: logError } = await supabase
      .from('defaulter_messages_log')
      .insert({
        customer_id: customerId || 'unknown',
        customer_name: customerName,
        customer_phone: customerPhone.replace(/\D/g, ''),
        days_overdue: 0, // Não é uma cobrança de atraso
        message_template: TEMPLATE_NAME,
        message_text: `Template: ${TEMPLATE_NAME} | Cliente: ${customerName} | Processo: ${processNumber || 'N/A'} | Tipo: Cobrança de Documentos`,
        status: 'sent',
        chatguru_message_id: chatguruResponse?.message_id || null,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });

    if (logError) {
      console.error('Error logging message:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: chatguruResponse?.message_id,
        template: TEMPLATE_NAME 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-document-request function:', error);
    
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
