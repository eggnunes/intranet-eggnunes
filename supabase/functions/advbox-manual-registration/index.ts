 // Edge Function para cadastro manual de cliente e processo no ADVBox
 // Usado quando o contrato é assinado presencialmente (sem ZapSign)
 
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
     
     if (settings.users && Array.isArray(settings.users)) {
       const users = settings.users.map((u: any) => ({
         id: String(u.id || u.user_id || u.users_id),
         name: u.name || u.full_name || u.nome || u.email,
       })).filter((u: any) => u.id && u.id !== 'undefined');
       
       const mariana = users.find((u: any) => u.name?.toLowerCase().includes(DEFAULT_RESPONSIBLE_NAME.toLowerCase()));
       result.defaultUserId = mariana ? mariana.id : users[0]?.id;
     }
     
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
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Verificar autenticação
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       return new Response(JSON.stringify({ error: 'Não autorizado' }), 
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     const { contrato_id } = await req.json();
 
     if (!contrato_id) {
       return new Response(JSON.stringify({ error: 'contrato_id é obrigatório' }), 
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     console.log('Cadastro manual ADVBox para contrato:', contrato_id);
 
     if (!ADVBOX_TOKEN) {
       return new Response(JSON.stringify({ error: 'Token ADVBOX não configurado' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // Buscar contrato
     const { data: contrato, error: contratoError } = await supabase
       .from('fin_contratos')
       .select('*')
       .eq('id', contrato_id)
       .single();
 
     if (contratoError || !contrato) {
       return new Response(JSON.stringify({ error: 'Contrato não encontrado' }), 
         { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // Verificar se já foi sincronizado
     if (contrato.advbox_sync_status === 'synced') {
       return new Response(JSON.stringify({ 
         success: true, 
         message: 'Contrato já foi sincronizado com ADVBox',
         advboxCustomerId: contrato.advbox_customer_id,
         advboxLawsuitId: contrato.advbox_lawsuit_id,
       }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // Buscar configurações do ADVBox
     const settings = await getAdvboxSettings();
     
     if (!settings.defaultUserId || !settings.defaultOriginId) {
       return new Response(JSON.stringify({ error: 'Configurações do ADVBox incompletas' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // 1. Criar ou buscar cliente
     let customerId: string | null = null;
     const existingCustomer = await findExistingCustomer(contrato.client_cpf || '', contrato.client_name);
     
     if (existingCustomer) {
       customerId = String(existingCustomer.id);
       console.log('Using existing customer:', customerId);
     } else {
       await sleep(1000);
       customerId = await createCustomerInAdvbox(contrato, settings);
       console.log('Created new customer:', customerId);
     }
     
     if (!customerId) {
       await supabase.from('fin_contratos').update({
         advbox_sync_status: 'error',
         advbox_sync_error: 'Não foi possível criar cliente no ADVBox',
       }).eq('id', contrato_id);
       
       return new Response(JSON.stringify({ error: 'Não foi possível criar cliente no ADVBox' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // 2. Criar processo
     await sleep(1500);
     let lawsuitId: string | null = null;
     
     try {
       lawsuitId = await createLawsuitInAdvbox(customerId, contrato, settings);
       console.log('Created lawsuit:', lawsuitId);
     } catch (error) {
       console.error('Error creating lawsuit:', error);
       
       await supabase.from('fin_contratos').update({
         advbox_customer_id: customerId,
         advbox_sync_status: 'partial',
         advbox_sync_error: 'Cliente criado, mas erro ao criar processo',
         assinatura_status: 'manual_signature',
         assinado_em: new Date().toISOString(),
       }).eq('id', contrato_id);
       
       return new Response(JSON.stringify({ 
         success: false, 
         error: 'Cliente criado, mas erro ao criar processo',
         advboxCustomerId: customerId,
       }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
 
     // 3. Criar tarefa para Mariana
     await sleep(1000);
     await createTaskForMariana(lawsuitId!, contrato.client_name, contrato.product_name, settings);
 
     // 4. Atualizar contrato
     await supabase.from('fin_contratos').update({
       advbox_customer_id: customerId,
       advbox_lawsuit_id: lawsuitId,
       advbox_sync_status: 'synced',
       advbox_sync_error: null,
       assinatura_status: 'manual_signature',
       assinado_em: new Date().toISOString(),
     }).eq('id', contrato_id);
 
     console.log('Cadastro manual concluído com sucesso');
 
     return new Response(JSON.stringify({ 
       success: true, 
       message: 'Cliente e processo cadastrados no ADVBox com sucesso!',
       advboxCustomerId: customerId,
       advboxLawsuitId: lawsuitId,
     }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
 
   } catch (error) {
     console.error('Erro no cadastro manual:', error);
     return new Response(JSON.stringify({ error: 'Erro interno no servidor' }), 
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
   }
 });