 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 interface ZapSignWebhookPayload {
   event_type: string;
   doc_token: string;
   doc_status: string;
   signer_token?: string;
   signer_status?: string;
   signer_name?: string;
   signer_email?: string;
   signed_file?: string;
   signed_file_url?: string;
   created_at?: string;
 }
 
 serve(async (req) => {
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const payload: ZapSignWebhookPayload = await req.json();
     console.log('Webhook ZapSign recebido:', JSON.stringify(payload, null, 2));
 
     const { event_type, doc_token, doc_status, signer_token, signer_status, signed_file_url } = payload;
 
     if (!doc_token) {
       console.error('doc_token não fornecido no webhook');
       return new Response(
         JSON.stringify({ error: 'doc_token é obrigatório' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Buscar documento no banco
     const { data: document, error: fetchError } = await supabase
       .from('zapsign_documents')
       .select('*')
       .eq('document_token', doc_token)
       .maybeSingle();
 
     if (fetchError) {
       console.error('Erro ao buscar documento:', fetchError);
       return new Response(
         JSON.stringify({ error: 'Erro ao buscar documento' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     if (!document) {
       console.log('Documento não encontrado no banco:', doc_token);
       // Retornar 200 mesmo assim para não reenviar webhook
       return new Response(
         JSON.stringify({ message: 'Documento não rastreado', doc_token }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log('Documento encontrado:', document.id);
 
     // Preparar atualizações
     const updates: Record<string, any> = {
       updated_at: new Date().toISOString(),
     };
 
     // Atualizar status do signatário específico
     if (signer_token) {
       if (signer_token === document.office_signer_token) {
         updates.office_signer_status = signer_status || 'signed';
         console.log('Atualizado status do signatário do escritório:', updates.office_signer_status);
       } else if (signer_token === document.client_signer_token) {
         updates.client_signer_status = signer_status || 'signed';
         console.log('Atualizado status do signatário cliente:', updates.client_signer_status);
         
         // Se cliente assinou, registrar data
         if (signer_status === 'signed') {
           updates.signed_at = new Date().toISOString();
         }
       }
     }
 
     // Mapear status do documento
     switch (event_type) {
       case 'doc_signed':
         // Um signatário assinou - verificar se todos assinaram
         if (document.document_type === 'contrato') {
           // Para contratos, verificar se cliente assinou
           if (signer_token === document.client_signer_token) {
             updates.status = 'signed';
             updates.signed_at = new Date().toISOString();
           }
         } else {
           // Procuração/Declaração - apenas cliente
           updates.status = 'signed';
           updates.signed_at = new Date().toISOString();
         }
         break;
 
       case 'doc_completed':
       case 'all_signed':
         updates.status = 'completed';
         updates.completed_at = new Date().toISOString();
         if (signed_file_url) {
           updates.signed_file_url = signed_file_url;
         }
         break;
 
       case 'doc_expired':
         updates.status = 'expired';
         break;
 
       case 'doc_canceled':
       case 'doc_refused':
         updates.status = 'canceled';
         break;
 
       default:
         console.log('Evento não mapeado:', event_type);
     }
 
     // Atualizar arquivo assinado se disponível
     if (signed_file_url) {
       updates.signed_file_url = signed_file_url;
     }
 
     // Atualizar documento no banco
     const { error: updateError } = await supabase
       .from('zapsign_documents')
       .update(updates)
       .eq('id', document.id);
 
     if (updateError) {
       console.error('Erro ao atualizar documento:', updateError);
       return new Response(
         JSON.stringify({ error: 'Erro ao atualizar documento' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log('Documento atualizado com sucesso:', {
       documentId: document.id,
       updates,
     });
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message: 'Webhook processado com sucesso',
         documentId: document.id,
         eventType: event_type,
       }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Erro no webhook ZapSign:', error);
     return new Response(
       JSON.stringify({ 
         error: 'Erro interno no processamento do webhook',
         details: error instanceof Error ? error.message : 'Erro desconhecido'
       }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });