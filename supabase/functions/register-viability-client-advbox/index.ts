import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAdvboxRequest(
  endpoint: string,
  method = 'GET',
  body?: Record<string, unknown>,
  retryCount = 0
): Promise<any> {
  const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
  if (!ADVBOX_TOKEN) throw new Error('ADVBOX_API_TOKEN não configurado');

  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 3;

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

  const response = await fetch(url, options);

  if (response.status === 429 && retryCount < maxRetries) {
    const waitTime = Math.pow(2, retryCount) * 2000;
    await sleep(waitTime);
    return makeAdvboxRequest(endpoint, method, body, retryCount + 1);
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.error('Advbox API error:', response.status, responseText.substring(0, 500));
    throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }

  if (!responseText.trim()) return { success: true };
  return JSON.parse(responseText);
}

async function findExistingCustomer(cpf: string, name: string): Promise<any | null> {
  try {
    const response = await makeAdvboxRequest('/customers?limit=1000');
    const customers = response.data || [];

    const cpfClean = cpf.replace(/\D/g, '');
    let found = customers.find((c: any) => {
      const customerCpf = (c.cpf || c.document || '').replace(/\D/g, '');
      return customerCpf === cpfClean && cpfClean.length === 11;
    });

    if (found) return found;

    const nameLower = name.toLowerCase().trim();
    return customers.find((c: any) => (c.name || c.full_name || '').toLowerCase().trim() === nameLower) || null;
  } catch (error) {
    console.error('Error searching customer:', error);
    return null;
  }
}

async function getAdvboxSettings(): Promise<{ defaultUserId?: string; defaultOriginId?: string; origins?: any[] }> {
  const result: { defaultUserId?: string; defaultOriginId?: string; origins?: any[] } = {};

  try {
    const response = await makeAdvboxRequest('/settings');
    const settings = response.data || response;

    if (settings.users && Array.isArray(settings.users)) {
      const users = settings.users.map((u: any) => ({
        id: String(u.id || u.user_id || u.users_id),
        name: u.name || u.full_name || u.nome || u.email,
      })).filter((u: any) => u.id && u.id !== 'undefined');

      const mariana = users.find((u: any) => u.name?.toLowerCase().includes('mariana'));
      result.defaultUserId = mariana ? mariana.id : users[0]?.id;
    }

    if (settings.customers_origins && Array.isArray(settings.customers_origins)) {
      const origins = settings.customers_origins.map((o: any) => ({
        id: String(o.id || o.customers_origins_id),
        name: o.name || o.origin || o.origem,
      })).filter((o: any) => o.id && o.id !== 'undefined');

      result.origins = origins;
      const naoInformado = origins.find((o: any) =>
        o.name.toLowerCase().includes('não informado') || o.name.toLowerCase().includes('nao informado')
      );
      result.defaultOriginId = naoInformado ? naoInformado.id : origins[0]?.id;
    }

    return result;
  } catch (error) {
    console.error('Error fetching Advbox settings:', error);
    return result;
  }
}

function mapComoConheceuToOriginId(comoConheceu: string | null, origins: any[]): string | undefined {
  if (!comoConheceu || !origins || origins.length === 0) return undefined;
  const lower = comoConheceu.toLowerCase();
  const match = origins.find((o: any) => o.name.toLowerCase().includes(lower) || lower.includes(o.name.toLowerCase()));
  return match?.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { viabilidade_id } = await req.json();

    if (!viabilidade_id) {
      return new Response(JSON.stringify({ error: 'viabilidade_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar dados da viabilidade
    const { data: viabilidade, error: vErr } = await supabase
      .from('viabilidade_clientes')
      .select('*')
      .eq('id', viabilidade_id)
      .single();

    if (vErr || !viabilidade) {
      return new Response(JSON.stringify({ error: 'Viabilidade não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Já cadastrado?
    if (viabilidade.advbox_customer_id) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Cliente já cadastrado no ADVBox',
        advbox_customer_id: viabilidade.advbox_customer_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar settings do ADVBox
    const settings = await getAdvboxSettings();

    // Verificar se já existe no ADVBox por CPF/nome
    const cpf = viabilidade.cpf || '';
    const existing = await findExistingCustomer(cpf, viabilidade.nome);

    if (existing) {
      const advboxId = String(existing.id);
      await supabase.from('viabilidade_clientes')
        .update({ advbox_customer_id: advboxId })
        .eq('id', viabilidade_id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Cliente já existia no ADVBox e foi vinculado',
        advbox_customer_id: advboxId,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mapear origem
    let originId = settings.defaultOriginId;
    if (viabilidade.como_conheceu && settings.origins) {
      const mapped = mapComoConheceuToOriginId(viabilidade.como_conheceu, settings.origins);
      if (mapped) originId = mapped;
    }

    // Extrair endereço
    const endereco = viabilidade.endereco || '';
    let city = 'Não informado';
    let state = 'MG';
    let street = 'Endereço não informado, S/N';
    let neighborhood = 'Não informado';

    if (endereco) {
      const parts = endereco.split(',').map((p: string) => p.trim());
      if (parts.length >= 4) {
        street = `${parts[0]}, ${parts[1] || 'S/N'}`;
        neighborhood = parts[2] || 'Não informado';
        city = parts[3] || 'Não informado';
        if (parts[4]) state = parts[4].substring(0, 2).toUpperCase();
      } else if (parts.length >= 1) {
        street = endereco;
      }
    }

    // Criar cliente no ADVBox
    const customerData: Record<string, any> = {
      name: viabilidade.nome,
      cpf: cpf.replace(/\D/g, ''),
      phone: (viabilidade.telefone || '').replace(/\D/g, '') || undefined,
      email: viabilidade.email || undefined,
      type: viabilidade.tipo_pessoa === 'juridica' ? 'company' : 'person',
      users_id: settings.defaultUserId,
      customers_origins_id: originId,
      city,
      street,
      neighborhood,
      state,
    };

    // Campos opcionais
    if (viabilidade.rg) customerData.rg = viabilidade.rg;
    if (viabilidade.profissao) customerData.profession = viabilidade.profissao;
    if (viabilidade.estado_civil) customerData.marital_status = viabilidade.estado_civil;
    if (viabilidade.data_nascimento) customerData.birthday = viabilidade.data_nascimento;

    // Remover campos undefined
    Object.keys(customerData).forEach(k => {
      if (customerData[k] === undefined) delete customerData[k];
    });

    console.log('Creating customer in ADVBox:', JSON.stringify(customerData));

    const response = await makeAdvboxRequest('/customers', 'POST', customerData);
    const advboxCustomerId = String(response.data?.id || response.id);

    // Atualizar viabilidade com o ID do ADVBox
    await supabase.from('viabilidade_clientes')
      .update({ advbox_customer_id: advboxCustomerId })
      .eq('id', viabilidade_id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Cliente cadastrado no ADVBox com sucesso!',
      advbox_customer_id: advboxCustomerId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Erro ao cadastrar cliente no ADVBox',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
