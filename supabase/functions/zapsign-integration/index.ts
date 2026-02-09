import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ZAPSIGN_API_URL = 'https://api.zapsign.com.br/api/v1';

// Configurações dos signatários internos
const SIGNERS_CONFIG = {
  marcos: {
    name: "Marcos Luiz Egg Nunes",
    qualification: "Contratado",
    tokenEnvKey: "ZAPSIGN_TOKEN_MARCOS",
  },
  rafael: {
    name: "Rafael Egg Nunes",
    qualification: "Contratado",
    tokenEnvKey: "ZAPSIGN_USER_TOKEN",
  },
};

// Mapeamento de testemunhas para seus tokens
const WITNESS_TOKEN_MAP: Record<string, string> = {
  'daniel': 'ZAPSIGN_TOKEN_DANIEL',
  'jhonny': 'ZAPSIGN_TOKEN_JHONNY',
  'lucas': 'ZAPSIGN_TOKEN_LUCAS',
};

const WITNESS_DISPLAY_NAMES: Record<string, string> = {
  'daniel': 'Daniel',
  'jhonny': 'Johnny',
  'lucas': 'Lucas',
};

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
  signature_placement?: string;
}

interface WitnessInput {
  name: string;
  tokenKey: string; // 'daniel' | 'jhonny' | 'lucas'
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
  witnesses?: WitnessInput[];
}

// Helper para assinar automaticamente
async function autoSign(
  apiToken: string,
  userToken: string,
  signerToken: string,
  signerName: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    console.log(`Assinando automaticamente para ${signerName}...`);
    const response = await fetch(`${ZAPSIGN_API_URL}/sign/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_token: userToken,
        signer_token: signerToken,
      }),
    });

    const text = await response.text();
    console.log(`Assinatura ${signerName} (status ${response.status}):`, text);

    if (response.ok) {
      return { success: true, result: JSON.parse(text) };
    } else {
      return { success: false, error: text };
    }
  } catch (err) {
    console.error(`Erro ao assinar para ${signerName}:`, err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateDocumentRequest = await req.json();
    console.log('Recebido pedido para criar documento no ZapSign:', {
      documentType: body.documentType,
      documentName: body.documentName,
      clientName: body.clientName,
      witnesses: body.witnesses?.map(w => w.name),
    });

    if (!body.pdfBase64 || !body.clientName || !body.documentName) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando: pdfBase64, clientName, documentName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let cleanBase64 = body.pdfBase64;
    if (cleanBase64.startsWith('data:')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    // Formatar telefone
    let phoneNumber = body.clientPhone || '';
    let phoneCountry = '55';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('55') && phoneNumber.length > 11) {
      phoneNumber = phoneNumber.substring(2);
    }

    const isContract = body.documentType === 'contrato' && body.includeOfficeSigner !== false;
    const signers: Signer[] = [];

    if (isContract) {
      // ===== 5 SIGNATÁRIOS PARA CONTRATOS =====
      
      // 1. Marcos (1º Contratado)
      signers.push({
        name: SIGNERS_CONFIG.marcos.name,
        lock_name: true,
        auth_mode: 'assinaturaTela',
        require_selfie_photo: false,
        require_document_photo: false,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        qualification: 'Contratado',
        signature_placement: '<<<<assinatura_contratado1>>>>',
      });

      // 2. Rafael (2º Contratado)
      signers.push({
        name: SIGNERS_CONFIG.rafael.name,
        lock_name: true,
        auth_mode: 'assinaturaTela',
        require_selfie_photo: false,
        require_document_photo: false,
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        qualification: 'Contratado',
        signature_placement: '<<<<assinatura_contratado2>>>>',
      });

      // 3. Cliente (Contratante)
      signers.push({
        name: body.clientName,
        email: body.clientEmail || '',
        phone_country: phoneCountry,
        phone_number: phoneNumber,
        lock_name: true,
        lock_email: !!body.clientEmail,
        lock_phone: !!phoneNumber,
        auth_mode: 'assinaturaTela',
        require_selfie_photo: true,
        require_document_photo: true,
        send_automatic_email: body.sendViaEmail ?? true,
        send_automatic_whatsapp: body.sendViaWhatsapp ?? false,
        qualification: 'Contratante',
        signature_placement: '<<<<assinatura_contratante>>>>',
      });

      // 4. Testemunha 1
      const witness1 = body.witnesses?.[0];
      if (witness1) {
        signers.push({
          name: WITNESS_DISPLAY_NAMES[witness1.tokenKey] || witness1.name,
          lock_name: true,
          auth_mode: 'assinaturaTela',
          require_selfie_photo: false,
          require_document_photo: false,
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          qualification: 'Testemunha',
          signature_placement: '<<<<assinatura_testemunha1>>>>',
        });
      }

      // 5. Testemunha 2
      const witness2 = body.witnesses?.[1];
      if (witness2) {
        signers.push({
          name: WITNESS_DISPLAY_NAMES[witness2.tokenKey] || witness2.name,
          lock_name: true,
          auth_mode: 'assinaturaTela',
          require_selfie_photo: false,
          require_document_photo: false,
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          qualification: 'Testemunha',
          signature_placement: '<<<<assinatura_testemunha2>>>>',
        });
      }

      console.log(`Contrato com ${signers.length} signatários:`, signers.map(s => `${s.name} (${s.qualification})`));
    } else {
      // ===== PROCURAÇÃO/DECLARAÇÃO: apenas cliente =====
      signers.push({
        name: body.clientName,
        email: body.clientEmail || '',
        phone_country: phoneCountry,
        phone_number: phoneNumber,
        lock_name: true,
        lock_email: !!body.clientEmail,
        lock_phone: !!phoneNumber,
        auth_mode: 'assinaturaTela',
        require_selfie_photo: true,
        require_document_photo: true,
        send_automatic_email: body.sendViaEmail ?? true,
        send_automatic_whatsapp: body.sendViaWhatsapp ?? false,
        qualification: 'Contratante',
      });
    }

    const documentPayload = {
      name: body.documentName,
      base64_pdf: cleanBase64,
      signers: signers,
      lang: 'pt-br',
      disable_signer_emails: !(body.sendViaEmail ?? false),
      signed_file_only_finished: true,
      brand_primary_color: '#1e40af',
      external_id: `${body.documentType}_${Date.now()}`,
    };

    console.log('Enviando para ZapSign API...', {
      endpoint: `${ZAPSIGN_API_URL}/docs/`,
      signersCount: signers.length,
      isContract,
      signerNames: signers.map(s => s.name),
    });

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
    console.log('Resposta ZapSign (body):', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('Erro na API ZapSign:', responseText);
      
      let userMessage = 'Erro inesperado na API do ZapSign. Tente novamente.';
      if (response.status === 402) {
        userMessage = 'O plano de API do ZapSign está inativo ou expirado. Acesse o painel do ZapSign em Configurações > Planos e Preços para verificar/renovar o plano.';
      } else if (response.status === 401) {
        userMessage = 'Token de API do ZapSign inválido ou expirado. Verifique a configuração do token.';
      } else if (response.status === 400) {
        userMessage = 'Dados inválidos enviados para o ZapSign. Verifique as informações do documento e tente novamente.';
      } else if (response.status === 429) {
        userMessage = 'Limite de requisições da API do ZapSign atingido. Aguarde alguns minutos e tente novamente.';
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar documento no ZapSign', 
          details: responseText, 
          zapSignStatus: response.status,
          userMessage,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Documento criado com sucesso:', { token: data.token, signersCount: data.signers?.length });

    // ===== ASSINATURAS AUTOMÁTICAS PARA CONTRATOS =====
    const autoSignResults: Record<string, { success: boolean; error?: string }> = {};

    if (isContract && data.signers?.length >= 3) {
      // Índices: 0=Marcos, 1=Rafael, 2=Cliente, 3=Testemunha1, 4=Testemunha2

      // 1. Marcos
      const marcosToken = Deno.env.get('ZAPSIGN_TOKEN_MARCOS');
      if (marcosToken && data.signers[0]) {
        autoSignResults.marcos = await autoSign(ZAPSIGN_API_TOKEN, marcosToken, data.signers[0].token, 'Marcos');
      }

      // 2. Rafael
      const rafaelToken = Deno.env.get('ZAPSIGN_USER_TOKEN');
      if (rafaelToken && data.signers[1]) {
        autoSignResults.rafael = await autoSign(ZAPSIGN_API_TOKEN, rafaelToken, data.signers[1].token, 'Rafael');
      }

      // 3. Testemunha 1
      const witness1 = body.witnesses?.[0];
      if (witness1 && data.signers[3]) {
        const w1EnvKey = WITNESS_TOKEN_MAP[witness1.tokenKey];
        const w1Token = w1EnvKey ? Deno.env.get(w1EnvKey) : null;
        if (w1Token) {
          autoSignResults.witness1 = await autoSign(ZAPSIGN_API_TOKEN, w1Token, data.signers[3].token, witness1.name);
        }
      }

      // 4. Testemunha 2
      const witness2 = body.witnesses?.[1];
      if (witness2 && data.signers[4]) {
        const w2EnvKey = WITNESS_TOKEN_MAP[witness2.tokenKey];
        const w2Token = w2EnvKey ? Deno.env.get(w2EnvKey) : null;
        if (w2Token) {
          autoSignResults.witness2 = await autoSign(ZAPSIGN_API_TOKEN, w2Token, data.signers[4].token, witness2.name);
        }
      }

      console.log('Resultados assinaturas automáticas:', JSON.stringify(autoSignResults));
    }

    // ===== SALVAR NO BANCO DE DADOS =====
    try {
      const dbRecord: Record<string, any> = {
        document_token: data.token,
        document_type: body.documentType,
        document_name: body.documentName,
        client_name: body.clientName,
        client_email: body.clientEmail || null,
        client_phone: body.clientPhone || null,
        client_cpf: body.clientCpf || null,
        status: 'pending',
        original_file_url: data.original_file || null,
      };

      if (isContract && data.signers?.length >= 3) {
        // Marcos (índice 0)
        dbRecord.marcos_signer_token = data.signers[0]?.token || null;
        dbRecord.marcos_signer_status = autoSignResults.marcos?.success ? 'signed' : 'pending';
        dbRecord.office_signer_token = data.signers[0]?.token || null;
        dbRecord.office_signer_status = autoSignResults.marcos?.success ? 'signed' : 'pending';
        
        // Rafael (índice 1)
        dbRecord.rafael_signer_token = data.signers[1]?.token || null;
        dbRecord.rafael_signer_status = autoSignResults.rafael?.success ? 'signed' : 'pending';
        
        // Cliente (índice 2)
        dbRecord.client_signer_token = data.signers[2]?.token || null;
        dbRecord.client_signer_status = 'pending';
        dbRecord.sign_url = data.signers[2]?.sign_url || null;
        
        // Testemunha 1 (índice 3)
        if (data.signers[3] && body.witnesses?.[0]) {
          dbRecord.witness1_name = WITNESS_DISPLAY_NAMES[body.witnesses[0].tokenKey] || body.witnesses[0].name;
          dbRecord.witness1_signer_token = data.signers[3]?.token || null;
          dbRecord.witness1_signer_status = autoSignResults.witness1?.success ? 'signed' : 'pending';
        }
        
        // Testemunha 2 (índice 4)
        if (data.signers[4] && body.witnesses?.[1]) {
          dbRecord.witness2_name = WITNESS_DISPLAY_NAMES[body.witnesses[1].tokenKey] || body.witnesses[1].name;
          dbRecord.witness2_signer_token = data.signers[4]?.token || null;
          dbRecord.witness2_signer_status = autoSignResults.witness2?.success ? 'signed' : 'pending';
        }
      } else {
        // Procuração/Declaração - apenas cliente
        dbRecord.client_signer_token = data.signers[0]?.token || null;
        dbRecord.client_signer_status = 'pending';
        dbRecord.sign_url = data.signers[0]?.sign_url || null;
      }

      const { error: dbError } = await supabase.from('zapsign_documents').insert(dbRecord);
      if (dbError) {
        console.error('Erro ao salvar documento no banco:', dbError);
      } else {
        console.log('Documento salvo no banco');
      }
    } catch (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
    }

    // ===== ENVIAR NOTIFICAÇÃO WHATSAPP VIA Z-API PARA O CLIENTE =====
    const clientSignerIndex = isContract ? 2 : 0;
    const clientSignUrl = data.signers?.[clientSignerIndex]?.sign_url || null;

    if (clientSignUrl && phoneNumber) {
      try {
        const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_INSTANCE_ID') || '').trim();
        const ZAPI_TOKEN_ENV = (Deno.env.get('ZAPI_TOKEN') || '').trim();
        const ZAPI_CLIENT_TOKEN = (Deno.env.get('ZAPI_CLIENT_TOKEN') || '').trim();

        console.log(`[Z-API] Credentials debug - Instance ID length: ${ZAPI_INSTANCE_ID.length}, Token length: ${ZAPI_TOKEN_ENV.length}`);

        if (ZAPI_INSTANCE_ID && ZAPI_TOKEN_ENV && ZAPI_CLIENT_TOKEN) {
          const WHATSAPP_OFICIAL = '553132268742';
          const FOOTER_AVISO = `\n\n⚠️ *Este número é exclusivo para envio de avisos e informativos do escritório Egg Nunes Advogados Associados.*\nPara entrar em contato conosco, utilize nosso canal oficial:\n📞 WhatsApp Oficial: https://wa.me/${WHATSAPP_OFICIAL}\n\n_Não responda esta mensagem._`;

          const firstName = body.clientName.split(' ')[0];
          const docTypeLabel = body.documentType === 'contrato' ? 'Contrato de Honorários' : 'Procuração';

          const whatsappMessage = `Olá, *${firstName}*! 👋\n\nO escritório *Egg Nunes Advogados Associados* enviou um documento para sua assinatura digital.\n\n📄 *Documento:* ${docTypeLabel}\n📝 *Nome:* ${body.documentName}\n\n*Como assinar:*\n1️⃣ Clique no link abaixo para acessar o documento\n2️⃣ Leia atentamente todo o conteúdo\n3️⃣ Siga as instruções na tela para assinar digitalmente\n4️⃣ Você precisará tirar uma selfie e uma foto do seu documento de identificação para validação\n\n🔗 *Acesse e assine aqui:*\n${clientSignUrl}\n\n⏰ Por favor, assine o documento o mais breve possível para dar andamento ao seu processo.\n\nEm caso de dúvidas, entre em contato conosco pelo nosso canal oficial.` + FOOTER_AVISO;

          // Format phone for Z-API
          let zapiPhone = phoneNumber.replace(/\D/g, '');
          if (zapiPhone.length <= 11) {
            zapiPhone = `55${zapiPhone}`;
          }

          const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN_ENV}/send-text`;

          console.log(`[Z-API] Sending ZapSign notification to client ${body.clientName} at ${zapiPhone}`);

          const zapiResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': ZAPI_CLIENT_TOKEN,
            },
            body: JSON.stringify({
              phone: zapiPhone,
              message: whatsappMessage,
            }),
          });

          const zapiResponseText = await zapiResponse.text();
          console.log(`[Z-API] ZapSign notification response: ${zapiResponse.status} - ${zapiResponseText}`);

          if (zapiResponse.ok) {
            let zapiData;
            try { zapiData = JSON.parse(zapiResponseText); } catch { zapiData = {}; }

            // Log the notification
            await supabase.from('zapi_messages_log').insert({
              customer_name: body.clientName,
              customer_phone: zapiPhone,
              message_text: `Notificação ZapSign - ${docTypeLabel} - ${body.documentName}`,
              message_type: 'zapsign_assinatura',
              status: 'sent',
              zapi_message_id: zapiData.zaapId || zapiData.messageId || null,
            }).then(({ error: logError }) => {
              if (logError) console.error('[Z-API] Error logging ZapSign notification:', logError);
            });

            console.log(`[Z-API] ✓ ZapSign notification sent successfully to ${body.clientName}`);
          } else {
            console.error(`[Z-API] ✗ Failed to send ZapSign notification: ${zapiResponseText}`);

            await supabase.from('zapi_messages_log').insert({
              customer_name: body.clientName,
              customer_phone: zapiPhone,
              message_text: `Falha notificação ZapSign - ${docTypeLabel} - ${body.documentName}`,
              message_type: 'zapsign_assinatura',
              status: 'failed',
              error_message: zapiResponseText.substring(0, 500),
            }).then(({ error: logError }) => {
              if (logError) console.error('[Z-API] Error logging failed notification:', logError);
            });
          }
        } else {
          console.log('[Z-API] Z-API credentials not configured, skipping WhatsApp notification');
        }
      } catch (zapiError) {
        console.error('[Z-API] Error sending ZapSign WhatsApp notification:', zapiError);
        // Don't fail the entire request just because notification failed
      }
    } else {
      console.log('[ZapSign] No sign URL or phone number available, skipping WhatsApp notification');
    }

    // ===== RESULTADO =====
    const result = {
      success: true,
      documentToken: data.token,
      documentStatus: data.status,
      documentName: data.name,
      originalFileUrl: data.original_file,
      isContract,
      autoSignResults: isContract ? {
        marcos: autoSignResults.marcos?.success || false,
        rafael: autoSignResults.rafael?.success || false,
        witness1: autoSignResults.witness1?.success || false,
        witness2: autoSignResults.witness2?.success || false,
      } : undefined,
      witness1Name: body.witnesses?.[0] ? (WITNESS_DISPLAY_NAMES[body.witnesses[0].tokenKey] || body.witnesses[0].name) : undefined,
      witness2Name: body.witnesses?.[1] ? (WITNESS_DISPLAY_NAMES[body.witnesses[1].tokenKey] || body.witnesses[1].name) : undefined,
      signers: data.signers?.map((s: any) => ({
        name: s.name,
        email: s.email,
        signUrl: s.sign_url,
        status: s.status,
        token: s.token,
      })),
      signUrl: clientSignUrl,
      createdAt: data.created_at,
      whatsappNotificationSent: !!(clientSignUrl && phoneNumber),
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na integração ZapSign:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno na integração ZapSign', details: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
