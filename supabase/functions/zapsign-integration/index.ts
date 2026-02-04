import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPSIGN_API_URL = 'https://api.zapsign.com.br/api/v1';

interface Signer {
  name: string;
  email?: string;
  phone_country?: string;
  phone_number?: string;
  lock_name?: boolean;
  lock_email?: boolean;
  lock_phone?: boolean;
  auth_mode: string;
  require_selfie_photo?: boolean;
  require_document_photo?: boolean;
  send_automatic_email?: boolean;
  send_automatic_whatsapp?: boolean;
  qualification?: string;
}

interface CreateDocumentRequest {
  documentType: 'contrato' | 'procuracao';
  documentName: string;
  pdfBase64: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  requireSelfie?: boolean;
  requireDocumentPhoto?: boolean;
  sendViaWhatsapp?: boolean;
  sendViaEmail?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!ZAPSIGN_API_TOKEN) {
      console.error('ZAPSIGN_API_TOKEN não configurado');
      return new Response(
        JSON.stringify({ error: 'ZAPSIGN_API_TOKEN não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateDocumentRequest = await req.json();
    console.log('Recebido pedido para criar documento no ZapSign:', {
      documentType: body.documentType,
      documentName: body.documentName,
      clientName: body.clientName,
    });

    // Validar campos obrigatórios
    if (!body.pdfBase64 || !body.clientName || !body.documentName) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando: pdfBase64, clientName, documentName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpar o base64 - remover prefixo data:application/pdf;base64, se existir
    let cleanBase64 = body.pdfBase64;
    if (cleanBase64.startsWith('data:')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    // Formatar telefone para o padrão brasileiro
    let phoneNumber = body.clientPhone || '';
    let phoneCountry = '55'; // Brasil por padrão
    
    // Remove caracteres não numéricos
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    // Se começa com 55, remove
    if (phoneNumber.startsWith('55') && phoneNumber.length > 11) {
      phoneNumber = phoneNumber.substring(2);
    }

    // Configurar signatário (cliente)
    // Autenticação SEMPRE obrigatória (selfie + documento) - padrão fixo de segurança
    const signer: Signer = {
      name: body.clientName,
      email: body.clientEmail || '',
      phone_country: phoneCountry,
      phone_number: phoneNumber,
      lock_name: true,
      lock_email: !!body.clientEmail,
      lock_phone: !!phoneNumber,
      auth_mode: 'assinaturaTela', // Assinatura desenhada na tela
      require_selfie_photo: true, // Sempre exigir selfie
      require_document_photo: true, // Sempre exigir foto do documento
      send_automatic_email: body.sendViaEmail ?? true, // E-mail automático por padrão
      send_automatic_whatsapp: body.sendViaWhatsapp ?? false,
      qualification: 'Contratante',
    };

    // Montar payload para criar documento via PDF base64
    const documentPayload = {
      name: body.documentName,
      base64_pdf: cleanBase64,
      signers: [signer],
      lang: 'pt-br',
      disable_signer_emails: !(body.sendViaEmail ?? false),
      signed_file_only_finished: true,
      brand_primary_color: '#1e40af', // Cor do escritório
      external_id: `${body.documentType}_${Date.now()}`,
    };

    console.log('Enviando para ZapSign API...', {
      endpoint: `${ZAPSIGN_API_URL}/docs/`,
      signerName: signer.name,
      requireSelfie: signer.require_selfie_photo,
      requireDocumentPhoto: signer.require_document_photo,
    });

    // Fazer requisição para a API do ZapSign
    const response = await fetch(`${ZAPSIGN_API_URL}/docs/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentPayload),
    });

    const responseText = await response.text();
    console.log('Resposta ZapSign (status):', response.status);
    console.log('Resposta ZapSign (body):', responseText);

    if (!response.ok) {
      console.error('Erro na API ZapSign:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar documento no ZapSign',
          details: responseText,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Documento criado com sucesso no ZapSign:', {
      token: data.token,
      status: data.status,
      signersCount: data.signers?.length,
    });

    // Extrair informações importantes da resposta
    const result = {
      success: true,
      documentToken: data.token,
      documentStatus: data.status,
      documentName: data.name,
      originalFileUrl: data.original_file,
      signers: data.signers?.map((s: any) => ({
        name: s.name,
        email: s.email,
        signUrl: s.sign_url,
        status: s.status,
        token: s.token,
      })),
      signUrl: data.signers?.[0]?.sign_url || null,
      createdAt: data.created_at,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na integração ZapSign:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno na integração ZapSign',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
