 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
 const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
 const DEFAULT_RESPONSIBLE_NAME = 'Mariana';
 
 function sleep(ms: number): Promise<void> {
   return new Promise(resolve => setTimeout(resolve, ms));
 }
 
 async function makeAdvboxRequest(
   endpoint: string, 
   method = 'GET', 
   body?: Record<string, unknown>,
   retryCount = 0
 ): Promise<any> {
   const url = `${ADVBOX_API_BASE}${endpoint}`;
   const maxRetries = 3;
   
   console.log(`Making ${method} request to Advbox:`, url);
   
   const options: RequestInit = {
     method,
     headers: {
       'Authorization': `Bearer ${ADVBOX_TOKEN}`,
       'Content-Type': 'application/json',
       'Accept': 'application/json',
     },
   };
 
   if (body && method !== 'GET') {
     options.body = JSON.stringify(body);
   }
 
   try {
     const response = await fetch(url, options);
     
     if (response.status === 429 && retryCount < maxRetries) {
       const waitTime = Math.pow(2, retryCount) * 2000;
       console.log(`Rate limited. Waiting ${waitTime}ms before retry`);
       await sleep(waitTime);
       return makeAdvboxRequest(endpoint, method, body, retryCount + 1);
     }
     
     const responseText = await response.text();
     
     if (!response.ok) {
       console.error('Advbox API error:', response.status, responseText.substring(0, 500));
       throw new Error(`Advbox API error: ${response.status}`);
     }
 
     if (!responseText.trim()) return { success: true };
     if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
       throw new Error(`API retornou HTML em vez de JSON`);
     }
 
     return JSON.parse(responseText);
   } catch (e) {
     throw new Error(`Falha na requisição: ${e instanceof Error ? e.message : String(e)}`);
   }
 }
 
 interface AdvboxSettings {
   defaultUserId?: string;
   defaultOriginId?: string;
 }
 
 async function getAdvboxSettings(): Promise<AdvboxSettings> {
   const result: AdvboxSettings = {};
   
   try {
     const response = await makeAdvboxRequest('/settings');
     const settings = response.data || response;
     
     // Buscar Mariana como responsável padrão
     if (settings.users && Array.isArray(settings.users)) {
       const users = settings.users.map((u: any) => ({
         id: String(u.id || u.user_id || u.users_id),
         name: u.name || u.full_name || u.nome || u.email,
       })).filter((u: any) => u.id && u.id !== 'undefined');
       
       const mariana = users.find((u: any) => u.name?.toLowerCase().includes(DEFAULT_RESPONSIBLE_NAME.toLowerCase()));
       result.defaultUserId = mariana ? mariana.id : users[0]?.id;
     }
     
     // Usar "Não Informado" como origem padrão
     if (settings.customers_origins && Array.isArray(settings.customers_origins)) {
       const origins = settings.customers_origins.map((o: any) => ({
         id: String(o.id || o.customers_origins_id),
         name: o.name || o.origin || o.origem,
       })).filter((o: any) => o.id && o.id !== 'undefined');
       
       const naoInformado = origins.find((o: any) => o.name.toLowerCase().includes('não informado') || o.name.toLowerCase().includes('nao informado'));
       result.defaultOriginId = naoInformado ? naoInformado.id : origins[0]?.id;
     }
     
     return result;
   } catch (error) {
     console.error('Error fetching Advbox settings:', error);
     return result;
   }
 }
 
 async function findExistingCustomer(cpf: string, name: string): Promise<any | null> {
   try {
     const response = await makeAdvboxRequest('/customers?limit=1000');
     const customers = response.data || [];
     
     const cpfClean = cpf.replace(/\D/g, '');
     let found = customers.find((c: any) => {
       const customerCpf = (c.cpf || c.document || '').replace(/\D/g, '');
       return customerCpf === cpfClean;
     });
     
     if (found) return found;
     
     const nameLower = name.toLowerCase().trim();
     return customers.find((c: any) => (c.name || c.full_name || '').toLowerCase().trim() === nameLower) || null;
   } catch (error) {
     console.error('Error searching customer:', error);
     return null;
   }
 }
 
 async function createCustomerInAdvbox(contrato: any, settings: AdvboxSettings): Promise<string | null> {
   try {
     console.log('Creating customer:', contrato.client_name);
     
     const customerData = {
       name: contrato.client_name,
       cpf: contrato.client_cpf?.replace(/\D/g, ''),
       phone: contrato.client_phone?.replace(/\D/g, ''),
       email: contrato.client_email,
       type: 'person',
       users_id: settings.defaultUserId,
       customers_origins_id: settings.defaultOriginId,
       city: 'Não informado',
       street: 'Endereço não informado, S/N',
       neighborhood: 'Não informado',
       state: 'MG',
     };
     
     const response = await makeAdvboxRequest('/customers', 'POST', customerData);
     return response.data?.id || response.id;
   } catch (error: any) {
     if (error?.message?.includes('duplicate') || error?.message?.includes('already exists')) {
       const existing = await findExistingCustomer(contrato.client_cpf || '', contrato.client_name);
       if (existing) return String(existing.id);
     }
     throw error;
   }
 }
 
 async function createLawsuitInAdvbox(customerId: string, contrato: any, settings: AdvboxSettings): Promise<string | null> {
   console.log('Creating lawsuit for customer:', customerId);
   
   const lawsuitData: Record<string, any> = {
     customer_id: customerId,
     title: contrato.product_name,
     description: contrato.objeto_contrato || `Contrato: ${contrato.product_name}`,
     type: 'judicial',
     status: 'active',
   };
   
   if (settings.defaultUserId) lawsuitData.users_id = settings.defaultUserId;
   
   const response = await makeAdvboxRequest('/lawsuits', 'POST', lawsuitData);
   return response.data?.id || response.id;
 }
 
 async function createTaskForMariana(lawsuitId: string, clientName: string, productName: string, settings: AdvboxSettings): Promise<void> {
   console.log('Creating task for Mariana');
   
   const dueDate = new Date();
   let businessDays = 0;
   while (businessDays < 2) {
     dueDate.setDate(dueDate.getDate() + 1);
     const dayOfWeek = dueDate.getDay();
     if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDays++;
   }
   
   try {
     await makeAdvboxRequest('/posts', 'POST', {
       title: `Analisar novo caso - ${clientName}`,
       description: `Cliente ${clientName} assinou contrato para ${productName}. Analisar documentação e designar advogado responsável.`,
       lawsuit_id: lawsuitId,
       users_id: settings.defaultUserId,
       due_date: dueDate.toISOString().split('T')[0],
       status: 'pending',
     });
     console.log('Task created successfully');
   } catch (error) {
     console.error('Error creating task (non-fatal):', error);
   }
 }
 
 async function syncContractToAdvbox(supabase: any, contrato: any): Promise<{ customerId?: string; lawsuitId?: string; error?: string }> {
   if (!ADVBOX_TOKEN) return { error: 'Token ADVBOX não configurado' };
   
   try {
     console.log('Syncing contract to ADVBox:', contrato.id);
     const settings = await getAdvboxSettings();
     
     if (!settings.defaultUserId || !settings.defaultOriginId) {
       return { error: 'Configurações do ADVBox incompletas' };
     }
     
     // 1. Criar ou buscar cliente
     let customerId: string | null = null;
     const existingCustomer = await findExistingCustomer(contrato.client_cpf || '', contrato.client_name);
     
     if (existingCustomer) {
       customerId = String(existingCustomer.id);
     } else {
       await sleep(1000);
       customerId = await createCustomerInAdvbox(contrato, settings);
     }
     
     if (!customerId) return { error: 'Não foi possível criar cliente no ADVBox' };
     
     // 2. Criar processo
     await sleep(1500);
     const lawsuitId = await createLawsuitInAdvbox(customerId, contrato, settings);
     
     if (!lawsuitId) return { customerId, error: 'Erro ao criar processo' };
     
     // 3. Criar tarefa para Mariana
     await sleep(1000);
     await createTaskForMariana(lawsuitId, contrato.client_name, contrato.product_name, settings);
     
     return { customerId, lawsuitId };
   } catch (error) {
     console.error('Error syncing to ADVBox:', error);
     return { error: error instanceof Error ? error.message : String(error) };
   }
 }
 
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
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const payload: ZapSignWebhookPayload = await req.json();
     console.log('Webhook ZapSign recebido:', JSON.stringify(payload, null, 2));
 
     const { event_type, doc_token, signer_token, signer_status, signed_file_url } = payload;
 
     if (!doc_token) {
       return new Response(JSON.stringify({ error: 'doc_token é obrigatório' }), 
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // Buscar documento no banco
     const { data: document, error: fetchError } = await supabase
       .from('zapsign_documents')
       .select('*')
       .eq('document_token', doc_token)
       .maybeSingle();
 
     if (fetchError) {
       console.error('Erro ao buscar documento:', fetchError);
       return new Response(JSON.stringify({ error: 'Erro ao buscar documento' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     if (!document) {
       console.log('Documento não encontrado:', doc_token);
       return new Response(JSON.stringify({ message: 'Documento não rastreado' }), 
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     console.log('Documento encontrado:', document.id);
 
     const updates: Record<string, any> = { updated_at: new Date().toISOString() };
     let shouldSyncAdvbox = false;
 
    // Atualizar status do signatário
    if (signer_token) {
      if (signer_token === document.marcos_signer_token) {
        updates.marcos_signer_status = signer_status || 'signed';
        updates.office_signer_status = signer_status || 'signed';
      } else if (signer_token === document.rafael_signer_token) {
        updates.rafael_signer_status = signer_status || 'signed';
      } else if (signer_token === document.office_signer_token && !document.marcos_signer_token) {
        // Retrocompatibilidade para documentos antigos sem marcos_signer_token
        updates.office_signer_status = signer_status || 'signed';
      } else if (signer_token === document.witness1_signer_token) {
        updates.witness1_signer_status = signer_status || 'signed';
      } else if (signer_token === document.witness2_signer_token) {
        updates.witness2_signer_status = signer_status || 'signed';
      } else if (signer_token === document.client_signer_token) {
        updates.client_signer_status = signer_status || 'signed';
        if (signer_status === 'signed') {
          updates.signed_at = new Date().toISOString();
          shouldSyncAdvbox = true;
        }
      }
    }
 
     // Mapear status do documento
     switch (event_type) {
       case 'doc_signed':
         if (document.document_type === 'contrato') {
           if (signer_token === document.client_signer_token) {
             updates.status = 'signed';
             updates.signed_at = new Date().toISOString();
             shouldSyncAdvbox = true;
           }
         } else {
           updates.status = 'signed';
           updates.signed_at = new Date().toISOString();
         }
         break;
       case 'doc_completed':
       case 'all_signed':
         updates.status = 'completed';
         updates.completed_at = new Date().toISOString();
         if (signed_file_url) updates.signed_file_url = signed_file_url;
         break;
       case 'doc_expired':
         updates.status = 'expired';
         break;
       case 'doc_canceled':
       case 'doc_refused':
         updates.status = 'canceled';
         break;
     }
 
     if (signed_file_url) updates.signed_file_url = signed_file_url;
 
     // Atualizar documento
     await supabase.from('zapsign_documents').update(updates).eq('id', document.id);
 
     // Sincronizar com ADVBox se cliente assinou
     let advboxResult: any = {};
     
     if (shouldSyncAdvbox && document.fin_contrato_id && !document.advbox_sync_triggered) {
       console.log('Cliente assinou - sincronizando com ADVBox...');
       
       await supabase.from('zapsign_documents')
         .update({ advbox_sync_triggered: true, advbox_sync_at: new Date().toISOString() })
         .eq('id', document.id);
       
       const { data: contrato } = await supabase
         .from('fin_contratos')
         .select('*')
         .eq('id', document.fin_contrato_id)
         .single();
       
       if (contrato) {
         advboxResult = await syncContractToAdvbox(supabase, contrato);
         
         const contratoUpdate: Record<string, any> = {
           assinatura_status: 'signed',
           assinado_em: new Date().toISOString(),
         };
         
         if (advboxResult.customerId) contratoUpdate.advbox_customer_id = advboxResult.customerId;
         if (advboxResult.lawsuitId) contratoUpdate.advbox_lawsuit_id = advboxResult.lawsuitId;
         
         contratoUpdate.advbox_sync_status = advboxResult.lawsuitId ? 'synced' : (advboxResult.customerId ? 'partial' : 'error');
         if (advboxResult.error) contratoUpdate.advbox_sync_error = advboxResult.error;
         
         await supabase.from('fin_contratos').update(contratoUpdate).eq('id', document.fin_contrato_id);
         console.log('Contrato atualizado:', contratoUpdate);
       }
     }
 
     console.log('Webhook processado com sucesso');
 
     return new Response(JSON.stringify({ 
       success: true, 
       documentId: document.id,
       eventType: event_type,
       advboxSynced: !!advboxResult.lawsuitId,
     }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 
   } catch (error) {
     console.error('Erro no webhook:', error);
     return new Response(JSON.stringify({ error: 'Erro interno' }), 
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
   }
 });