 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

 const ZAPSIGN_API_URL = 'https://api.zapsign.com.br/api/v1';
 
 // Configurações do escritório para assinatura automática
 const OFFICE_SIGNER_NAME = "Egg Nunes Advocacia";
 const OFFICE_SIGNER_EMAIL = "contato@eggnunes.com.br";

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
   includeOfficeSigner?: boolean;
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
   
   const ZAPSIGN_USER_TOKEN = Deno.env.get('ZAPSIGN_USER_TOKEN');
   
   // Inicializar Supabase client para salvar no banco
   const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
   const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
 
   // Array de signatários
   const signers: Signer[] = [signer];
 
   // Para contratos, adicionar signatário do escritório (advogado)
   const isContract = body.documentType === 'contrato' && body.includeOfficeSigner !== false;
   
   if (isContract) {
     const officeSigner: Signer = {
       name: OFFICE_SIGNER_NAME,
       email: OFFICE_SIGNER_EMAIL,
       lock_name: true,
       lock_email: true,
       auth_mode: 'assinaturaTela', // Assinatura simples para o escritório
       require_selfie_photo: false,
       require_document_photo: false,
       send_automatic_email: false, // Não enviar e-mail, será assinado automaticamente
       send_automatic_whatsapp: false,
       qualification: 'Contratado',
     };
     // Escritório assina primeiro
     signers.unshift(officeSigner);
     console.log('Contrato detectado - adicionando signatário do escritório para assinatura automática');
   }

    // Montar payload para criar documento via PDF base64
    // NOTA: sandbox=true para ambiente de testes. Remover para produção.
    const documentPayload = {
      name: body.documentName,
      base64_pdf: cleanBase64,
      signers: signers,
      lang: 'pt-br',
      disable_signer_emails: !(body.sendViaEmail ?? false),
      signed_file_only_finished: true,
      brand_primary_color: '#1e40af', // Cor do escritório
      external_id: `${body.documentType}_${Date.now()}`,
      sandbox: true, // Modo sandbox para testes - remover quando contratar plano de produção
    };

    console.log('Enviando para ZapSign API...', {
      endpoint: `${ZAPSIGN_API_URL}/docs/`,
     signersCount: signers.length,
     isContract: isContract,
     signerNames: signers.map(s => s.name),
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
 
   // Se for contrato, assinar automaticamente pelo escritório
   let officeSignResult = null;
   if (isContract && ZAPSIGN_USER_TOKEN && data.signers?.length > 0) {
     const officeSignerData = data.signers[0]; // Primeiro signatário é o escritório
     console.log('Iniciando assinatura automática do escritório...', {
       signerToken: officeSignerData.token,
     });
 
     try {
       const signResponse = await fetch(`${ZAPSIGN_API_URL}/sign/`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${ZAPSIGN_API_TOKEN}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           user_token: ZAPSIGN_USER_TOKEN,
           signer_token: officeSignerData.token,
         }),
       });
 
       const signText = await signResponse.text();
       console.log('Resposta assinatura automática (status):', signResponse.status);
       console.log('Resposta assinatura automática (body):', signText);
 
       if (signResponse.ok) {
         officeSignResult = JSON.parse(signText);
         console.log('Assinatura automática do escritório realizada com sucesso!');
       } else {
         console.error('Erro na assinatura automática:', signText);
       }
     } catch (signError) {
       console.error('Erro ao tentar assinatura automática:', signError);
     }
   }
 
   // Salvar documento no banco de dados para rastreamento
   try {
     const clientSignerData = isContract ? data.signers[1] : data.signers[0];
     const officeSignerData = isContract ? data.signers[0] : null;
 
     const { error: dbError } = await supabase
       .from('zapsign_documents')
       .insert({
         document_token: data.token,
         document_type: body.documentType,
         document_name: body.documentName,
         client_name: body.clientName,
         client_email: body.clientEmail || null,
         client_phone: body.clientPhone || null,
         client_cpf: body.clientCpf || null,
         status: 'pending',
         sign_url: clientSignerData?.sign_url || null,
         original_file_url: data.original_file || null,
         office_signer_token: officeSignerData?.token || null,
         office_signer_status: officeSignResult ? 'signed' : (officeSignerData ? 'pending' : null),
         client_signer_token: clientSignerData?.token || null,
         client_signer_status: 'pending',
       });
 
     if (dbError) {
       console.error('Erro ao salvar documento no banco:', dbError);
     } else {
       console.log('Documento salvo no banco de dados para rastreamento');
     }
   } catch (dbError) {
     console.error('Erro ao salvar no banco:', dbError);
   }

    // Extrair informações importantes da resposta
   const clientSignerIndex = isContract ? 1 : 0;
    const result = {
      success: true,
      documentToken: data.token,
      documentStatus: data.status,
      documentName: data.name,
      originalFileUrl: data.original_file,
     officeSignatureCompleted: !!officeSignResult,
     isContract: isContract,
      signers: data.signers?.map((s: any) => ({
        name: s.name,
        email: s.email,
        signUrl: s.sign_url,
        status: s.status,
        token: s.token,
      })),
     signUrl: data.signers?.[clientSignerIndex]?.sign_url || null,
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
