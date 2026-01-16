// Contract Automation Edge Function
// Cadastra cliente e processo no ADVBOX automaticamente após geração de contrato

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

interface ClientData {
  id: number;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  telefone: string;
  email: string;
  cep?: string;
  cidade?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  estado?: string;
}

interface ContractData {
  client: ClientData;
  productName: string;
  objetoContrato?: string;
  valorTotal?: number;
  formaPagamento?: string;
  numeroParcelas?: number;
  valorParcela?: number;
  valorEntrada?: number;
  dataVencimento?: string;
  temHonorariosExito?: boolean;
  descricaoExito?: string;
  qualification?: string;
}

interface AdvboxSettings {
  defaultUserId?: string;
  defaultOriginId?: string;
  users?: Array<{ id: string; name: string }>;
  origins?: Array<{ id: string; name: string }>;
}

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
    console.log('Request body:', JSON.stringify(body));
  }

  try {
    const response = await fetch(url, options);
    
    console.log('Response status:', response.status);
    
    // Se recebeu 429 (Too Many Requests), aguardar e tentar novamente
    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 2000;
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
      await sleep(waitTime);
      return makeAdvboxRequest(endpoint, method, body, retryCount + 1);
    }
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Advbox API error:', response.status, responseText.substring(0, 500));
      throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    if (!responseText.trim()) {
      return { success: true };
    }

    // Verificar se a resposta é JSON válido
    if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
      console.error('Response is not JSON:', responseText.substring(0, 200));
      throw new Error(`API retornou HTML em vez de JSON`);
    }

    return JSON.parse(responseText);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Advbox API error')) {
      throw e;
    }
    console.error('Failed to make request:', e);
    throw new Error(`Falha na requisição: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Nome da responsável padrão (coordenadora)
const DEFAULT_RESPONSIBLE_NAME = 'Mariana';

// Buscar utm_source do lead pelo email ou telefone do cliente
async function getLeadMarketingSource(email?: string, phone?: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase não configurado para buscar origem do lead');
    return null;
  }
  
  if (!email && !phone) {
    console.log('Nenhum email ou telefone fornecido para buscar lead');
    return null;
  }
  
  try {
    console.log('Buscando origem do lead por email/telefone:', email, phone);
    
    // Limpar telefone para busca
    const phoneClean = phone?.replace(/\D/g, '');
    
    // Buscar na tabela captured_leads
    let query = `${SUPABASE_URL}/rest/v1/captured_leads?select=utm_source,utm_medium,email,phone&order=created_at.desc&limit=1`;
    
    // Construir filtro - buscar por email OU telefone
    const filters: string[] = [];
    if (email) {
      filters.push(`email.ilike.*${email.toLowerCase()}*`);
    }
    if (phoneClean && phoneClean.length >= 10) {
      // Buscar por telefone parcial (últimos 9 dígitos)
      const phoneSuffix = phoneClean.slice(-9);
      filters.push(`phone.ilike.*${phoneSuffix}*`);
    }
    
    if (filters.length === 0) {
      return null;
    }
    
    // Usar OR para buscar por qualquer um dos campos
    query += `&or=(${filters.join(',')})`;
    
    console.log('Query para buscar lead:', query);
    
    const response = await fetch(query, {
      headers: {
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Erro ao buscar lead:', response.status);
      return null;
    }
    
    const leads = await response.json();
    console.log('Leads encontrados:', leads?.length);
    
    if (leads && leads.length > 0) {
      const lead = leads[0];
      console.log('Lead encontrado:', { utm_source: lead.utm_source, utm_medium: lead.utm_medium });
      return lead.utm_source || lead.utm_medium || null;
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar origem do lead:', error);
    return null;
  }
}

// Mapear utm_source para origem do Advbox
function findOriginByMarketingSource(
  origins: Array<{ id: string; name: string }>, 
  utmSource: string
): { id: string; name: string } | null {
  const sourceLower = utmSource.toLowerCase().trim();
  
  console.log(`Buscando origem para utm_source: "${sourceLower}"`);
  console.log('Origens disponíveis:', origins.map(o => o.name));
  
  // Mapeamento de utm_source para possíveis nomes de origem no Advbox
  const sourceToOriginMappings: Record<string, string[]> = {
    'facebook': ['facebook', 'fb', 'meta', 'face'],
    'fb': ['facebook', 'fb', 'meta', 'face'],
    'instagram': ['instagram', 'insta', 'ig', 'meta'],
    'ig': ['instagram', 'insta', 'ig', 'meta'],
    'google': ['google', 'google ads', 'adwords', 'gads'],
    'google_ads': ['google', 'google ads', 'adwords', 'gads'],
    'tiktok': ['tiktok', 'tik tok', 'tt'],
    'youtube': ['youtube', 'yt'],
    'linkedin': ['linkedin', 'linked'],
    'twitter': ['twitter', 'x', 'tweet'],
    'organic': ['orgânico', 'organico', 'organic', 'direto'],
    'referral': ['indicação', 'indicacao', 'referral', 'parceiro'],
    'email': ['email', 'e-mail', 'newsletter'],
    'whatsapp': ['whatsapp', 'whats', 'wpp', 'zap'],
    'site': ['site', 'website', 'web'],
  };
  
  // Primeiro, tentar match direto com o nome da origem
  for (const origin of origins) {
    const originLower = origin.name.toLowerCase();
    
    // Match exato
    if (originLower === sourceLower || originLower.includes(sourceLower)) {
      console.log(`Match direto encontrado: "${origin.name}"`);
      return origin;
    }
  }
  
  // Segundo, usar mapeamento de variações
  const variations = sourceToOriginMappings[sourceLower] || [];
  for (const variation of variations) {
    for (const origin of origins) {
      const originLower = origin.name.toLowerCase();
      if (originLower.includes(variation) || variation.includes(originLower)) {
        console.log(`Match por variação encontrado: "${origin.name}" (via "${variation}")`);
        return origin;
      }
    }
  }
  
  // Terceiro, buscar por palavras parciais do utm_source
  const sourceWords = sourceLower.split(/[\s\-_]+/);
  for (const word of sourceWords) {
    if (word.length < 3) continue;
    for (const origin of origins) {
      if (origin.name.toLowerCase().includes(word)) {
        console.log(`Match por palavra parcial: "${origin.name}" (via "${word}")`);
        return origin;
      }
    }
  }
  
  console.log('Nenhuma origem correspondente encontrada para:', sourceLower);
  return null;
}

// Buscar configurações do Advbox (usuários e origens)
async function getAdvboxSettings(clientEmail?: string, clientPhone?: string): Promise<AdvboxSettings> {
  try {
    console.log('Fetching Advbox settings...');
    const response = await makeAdvboxRequest('/settings');
    
    const settings = response.data || response;
    console.log('Settings keys:', Object.keys(settings));
    
    const result: AdvboxSettings = {
      users: [],
      origins: [],
    };
    
    // Extrair usuários
    if (settings.users && Array.isArray(settings.users)) {
      result.users = settings.users.map((u: any) => ({
        id: String(u.id || u.user_id || u.users_id),
        name: u.name || u.full_name || u.nome || u.email,
      })).filter((u: any) => u.id && u.id !== 'undefined');
      console.log(`Found ${result.users?.length} users`);
    } else if (settings.account?.users && Array.isArray(settings.account.users)) {
      result.users = settings.account.users.map((u: any) => ({
        id: String(u.id || u.user_id || u.users_id),
        name: u.name || u.full_name || u.nome || u.email,
      })).filter((u: any) => u.id && u.id !== 'undefined');
      console.log(`Found ${result.users?.length} users in account`);
    }
    
    // Extrair origens de clientes
    if (settings.customers_origins && Array.isArray(settings.customers_origins)) {
      result.origins = settings.customers_origins.map((o: any) => ({
        id: String(o.id || o.customers_origins_id),
        name: o.name || o.origin || o.origem,
      })).filter((o: any) => o.id && o.id !== 'undefined');
      console.log(`Found ${result.origins?.length} customer origins`);
    } else if (settings.account?.customers_origins && Array.isArray(settings.account.customers_origins)) {
      result.origins = settings.account.customers_origins.map((o: any) => ({
        id: String(o.id || o.customers_origins_id),
        name: o.name || o.origin || o.origem,
      })).filter((o: any) => o.id && o.id !== 'undefined');
      console.log(`Found ${result.origins?.length} customer origins in account`);
    }
    
    // Buscar Mariana como responsável padrão
    if (result.users && result.users.length > 0) {
      const mariana = result.users.find((u: { id: string; name: string }) => 
        u.name?.toLowerCase().includes(DEFAULT_RESPONSIBLE_NAME.toLowerCase())
      );
      
      if (mariana) {
        result.defaultUserId = mariana.id;
        console.log(`Default user (Mariana): ${result.defaultUserId} (${mariana.name})`);
      } else {
        // Se não encontrar Mariana, usar o primeiro usuário como fallback
        result.defaultUserId = result.users[0].id;
        console.log(`Mariana not found, using first user as fallback: ${result.defaultUserId} (${result.users[0].name})`);
      }
    }
    
    // Buscar origem de marketing do lead (utm_source) pelo email/telefone do cliente
    if (result.origins && result.origins.length > 0) {
      let matchedOrigin: { id: string; name: string } | null = null;
      
      // Primeiro, tentar buscar a origem de marketing do lead (utm_source)
      if (clientEmail || clientPhone) {
        const utmSource = await getLeadMarketingSource(clientEmail, clientPhone);
        
        if (utmSource) {
          console.log(`Origem de marketing encontrada: "${utmSource}"`);
          matchedOrigin = findOriginByMarketingSource(result.origins, utmSource);
          
          if (matchedOrigin) {
            result.defaultOriginId = matchedOrigin.id;
            console.log(`Origem mapeada para utm_source "${utmSource}": ${result.defaultOriginId} (${matchedOrigin.name})`);
          }
        } else {
          console.log('Nenhuma origem de marketing (utm_source) encontrada para o lead');
        }
      }
      
      // Se não encontrar correspondência, usar a primeira origem como fallback
      if (!matchedOrigin) {
        result.defaultOriginId = result.origins[0].id;
        console.log(`Usando primeira origem como fallback: ${result.defaultOriginId} (${result.origins[0].name})`);
      }
    }
    
    // Log settings para debug
    console.log('Users available:', JSON.stringify(result.users));
    console.log('Origins available:', JSON.stringify(result.origins));
    
    return result;
  } catch (error) {
    console.error('Error fetching Advbox settings:', error);
    return { users: [], origins: [] };
  }
}

// Função para mapear productName para origem do Advbox
function findMatchingOrigin(
  origins: Array<{ id: string; name: string }>, 
  productName: string
): { id: string; name: string } | null {
  const productLower = productName.toLowerCase();
  
  // Mapeamento de palavras-chave do produto para possíveis origens
  const keywordMappings: Record<string, string[]> = {
    'imobiliário': ['imobiliário', 'imobiliario', 'imóveis', 'imoveis', 'obra', 'construtora'],
    'atraso': ['atraso', 'obra', 'construção', 'entrega'],
    'rescisão': ['rescisão', 'rescisao', 'contrato', 'distrato'],
    'férias': ['férias', 'ferias', 'prêmio', 'premio', 'trabalhista'],
    'isenção': ['isenção', 'isencao', 'ir', 'imposto', 'tributário', 'tributario'],
    'trabalhista': ['trabalhista', 'trabalho', 'clt', 'emprego'],
    'previdenciário': ['previdenciário', 'previdenciario', 'inss', 'aposentadoria', 'benefício'],
    'consumidor': ['consumidor', 'consumo', 'produto', 'serviço'],
    'família': ['família', 'familia', 'divórcio', 'pensão', 'guarda'],
  };
  
  // Primeiro, tentar match exato ou parcial com o nome da origem
  for (const origin of origins) {
    const originLower = origin.name.toLowerCase();
    
    // Match exato ou se o nome do produto contém o nome da origem
    if (productLower.includes(originLower) || originLower.includes(productLower)) {
      return origin;
    }
    
    // Verificar se alguma palavra-chave do produto corresponde à origem
    for (const [keyword, variations] of Object.entries(keywordMappings)) {
      if (productLower.includes(keyword)) {
        for (const variation of variations) {
          if (originLower.includes(variation)) {
            return origin;
          }
        }
      }
    }
  }
  
  // Se não encontrar match, tentar por palavras individuais
  const productWords = productLower.split(/[\s\-–]+/);
  for (const origin of origins) {
    const originLower = origin.name.toLowerCase();
    for (const word of productWords) {
      if (word.length > 3 && originLower.includes(word)) {
        return origin;
      }
    }
  }
  
  return null;
}

// Buscar cliente existente pelo CPF ou nome
async function findExistingCustomer(cpf: string, name: string): Promise<any | null> {
  try {
    console.log('Searching for existing customer with CPF:', cpf, 'or name:', name);
    
    const response = await makeAdvboxRequest('/customers?limit=1000');
    const customers = response.data || [];
    
    // Buscar por CPF primeiro (mais preciso)
    const cpfClean = cpf.replace(/\D/g, '');
    let found = customers.find((c: any) => {
      const customerCpf = (c.cpf || c.document || '').replace(/\D/g, '');
      return customerCpf === cpfClean;
    });
    
    if (found) {
      console.log('Found customer by CPF:', found.id);
      return found;
    }
    
    // Buscar por nome (case insensitive)
    const nameLower = name.toLowerCase().trim();
    found = customers.find((c: any) => {
      const customerName = (c.name || c.full_name || '').toLowerCase().trim();
      return customerName === nameLower;
    });
    
    if (found) {
      console.log('Found customer by name:', found.id);
      return found;
    }
    
    console.log('No existing customer found');
    return null;
  } catch (error) {
    console.error('Error searching for existing customer:', error);
    return null;
  }
}

// Formatar endereço no formato esperado pelo Advbox: "Rua Nome, 123"
function formatStreet(rua?: string, numero?: string): string {
  if (!rua) return '';
  
  const ruaClean = rua.trim();
  const numeroClean = numero?.trim() || 'S/N';
  
  // Verificar se já tem número no endereço
  if (/,\s*\d+/.test(ruaClean) || /\s+\d+$/.test(ruaClean)) {
    return ruaClean;
  }
  
  return `${ruaClean}, ${numeroClean}`;
}

// Criar cliente no ADVBOX
async function createCustomer(
  client: ClientData, 
  settings: AdvboxSettings
): Promise<{ id: string } | null> {
  try {
    console.log('Creating customer in ADVBOX:', client.nomeCompleto);
    
    // Formatar data de nascimento
    let birthDate = null;
    if (client.dataNascimento) {
      // Tentar converter formato DD/MM/YYYY para YYYY-MM-DD
      const parts = client.dataNascimento.split('/');
      if (parts.length === 3) {
        birthDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        birthDate = client.dataNascimento;
      }
    }
    
    // Formatar endereço com número
    const formattedStreet = formatStreet(client.rua, client.numero);
    console.log('Formatted street:', formattedStreet);
    
    // Montar payload com campos obrigatórios
    const customerData: Record<string, any> = {
      name: client.nomeCompleto,
      cpf: client.cpf?.replace(/\D/g, ''),
      rg: client.documentoIdentidade,
      birth_date: birthDate,
      marital_status: client.estadoCivil,
      profession: client.profissao,
      phone: client.telefone?.replace(/\D/g, ''),
      email: client.email,
      zip_code: client.cep?.replace(/\D/g, ''),
      city: client.cidade,
      street: formattedStreet, // Endereço formatado com número
      complement: client.complemento,
      neighborhood: client.bairro,
      state: client.estado,
      type: 'person', // pessoa física
    };
    
    // Adicionar responsável (obrigatório)
    if (settings.defaultUserId) {
      customerData.users_id = settings.defaultUserId;
      console.log('Setting users_id:', settings.defaultUserId);
    } else {
      console.warn('No default user found - this may cause API error');
    }
    
    // Adicionar origem do cliente (obrigatório)
    if (settings.defaultOriginId) {
      customerData.customers_origins_id = settings.defaultOriginId;
      console.log('Setting customers_origins_id:', settings.defaultOriginId);
    } else {
      console.warn('No default origin found - this may cause API error');
    }
    
    console.log('Customer payload:', JSON.stringify(customerData));
    
    const response = await makeAdvboxRequest('/customers', 'POST', customerData);
    
    console.log('Customer created successfully:', response);
    
    return { id: response.data?.id || response.id };
  } catch (error) {
    console.error('Error creating customer in ADVBOX:', error);
    throw error;
  }
}

// Criar processo no ADVBOX
async function createLawsuit(
  customerId: string, 
  productName: string, 
  objetoContrato?: string,
  settings?: AdvboxSettings
): Promise<{ id: string } | null> {
  try {
    console.log('Creating lawsuit in ADVBOX for customer:', customerId);
    
    const lawsuitData: Record<string, any> = {
      customer_id: customerId,
      title: productName,
      description: objetoContrato || `Contrato: ${productName}`,
      type: 'judicial', // Tipo padrão
      status: 'active',
    };
    
    // Adicionar responsável se disponível
    if (settings?.defaultUserId) {
      lawsuitData.users_id = settings.defaultUserId;
      console.log('Setting lawsuit users_id:', settings.defaultUserId);
    }
    
    console.log('Lawsuit payload:', JSON.stringify(lawsuitData));
    
    const response = await makeAdvboxRequest('/lawsuits', 'POST', lawsuitData);
    
    console.log('Lawsuit created successfully:', response);
    
    return { id: response.data?.id || response.id };
  } catch (error) {
    console.error('Error creating lawsuit in ADVBOX:', error);
    throw error;
  }
}

// Registrar contrato no banco de dados
async function registerContract(
  token: string,
  contractData: ContractData,
  advboxCustomerId?: string,
  advboxLawsuitId?: string,
  syncStatus = 'pending',
  syncError?: string
): Promise<string> {
  console.log('Registering contract in database...');
  
  const contractRecord = {
    client_id: contractData.client.id,
    client_name: contractData.client.nomeCompleto,
    client_cpf: contractData.client.cpf,
    client_email: contractData.client.email,
    client_phone: contractData.client.telefone,
    product_name: contractData.productName,
    objeto_contrato: contractData.objetoContrato,
    valor_total: contractData.valorTotal,
    forma_pagamento: contractData.formaPagamento,
    numero_parcelas: contractData.numeroParcelas,
    valor_parcela: contractData.valorParcela,
    valor_entrada: contractData.valorEntrada,
    data_vencimento: contractData.dataVencimento,
    tem_honorarios_exito: contractData.temHonorariosExito,
    descricao_exito: contractData.descricaoExito,
    qualification: contractData.qualification,
    advbox_customer_id: advboxCustomerId,
    advbox_lawsuit_id: advboxLawsuitId,
    advbox_sync_status: syncStatus,
    advbox_sync_error: syncError,
  };
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/fin_contratos`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(contractRecord),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error registering contract:', errorText);
    throw new Error(`Error registering contract: ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Contract registered:', result[0]?.id);
  
  return result[0]?.id;
}

// Atualizar status de sincronização do contrato
async function updateContractSyncStatus(
  token: string,
  contractId: string,
  advboxCustomerId?: string,
  advboxLawsuitId?: string,
  syncStatus?: string,
  syncError?: string
): Promise<void> {
  console.log('Updating contract sync status:', contractId, syncStatus);
  
  const updateData: Record<string, any> = {
    advbox_sync_status: syncStatus,
  };
  
  if (advboxCustomerId) updateData.advbox_customer_id = advboxCustomerId;
  if (advboxLawsuitId) updateData.advbox_lawsuit_id = advboxLawsuitId;
  if (syncError) updateData.advbox_sync_error = syncError;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/fin_contratos?id=eq.${contractId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error updating contract:', errorText);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar usuário
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY!,
      },
    });

    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userData = await userResponse.json();
    console.log('User verified:', userData.id);

    // Obter dados do contrato
    const contractData: ContractData = await req.json();
    
    if (!contractData.client || !contractData.productName) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing contract for:', contractData.client.nomeCompleto);
    
    let advboxCustomerId: string | undefined;
    let advboxLawsuitId: string | undefined;
    let syncStatus = 'pending';
    let syncError: string | undefined;
    
    // Verificar se o token do ADVBOX está configurado
    if (!ADVBOX_TOKEN) {
      console.warn('ADVBOX_API_TOKEN não configurado. Contrato será registrado sem sincronização.');
      syncStatus = 'error';
      syncError = 'Token ADVBOX não configurado';
    } else {
      try {
        // 0. Buscar configurações do Advbox (usuários e origens) - passando email/telefone para buscar origem de marketing
        console.log('Fetching Advbox settings with client email/phone:', contractData.client.email, contractData.client.telefone);
        const advboxSettings = await getAdvboxSettings(contractData.client.email, contractData.client.telefone);
        
        if (!advboxSettings.defaultUserId) {
          console.warn('No default user found in Advbox settings');
        }
        if (!advboxSettings.defaultOriginId) {
          console.warn('No default origin found in Advbox settings');
        }
        
        // 1. Verificar se cliente já existe no ADVBOX
        const existingCustomer = await findExistingCustomer(
          contractData.client.cpf, 
          contractData.client.nomeCompleto
        );
        
        if (existingCustomer) {
          advboxCustomerId = String(existingCustomer.id);
          console.log('Using existing customer:', advboxCustomerId);
        } else {
          // 2. Criar cliente no ADVBOX (com campos obrigatórios)
          await sleep(1000); // Delay para evitar rate limit
          const newCustomer = await createCustomer(contractData.client, advboxSettings);
          if (newCustomer) {
            advboxCustomerId = newCustomer.id;
            console.log('Created new customer:', advboxCustomerId);
          }
        }
        
        // 3. Criar processo no ADVBOX
        if (advboxCustomerId) {
          await sleep(1500); // Aguardar para evitar rate limit
          
          try {
            const lawsuit = await createLawsuit(
              advboxCustomerId, 
              contractData.productName,
              contractData.objetoContrato,
              advboxSettings
            );
            
            if (lawsuit) {
              advboxLawsuitId = lawsuit.id;
              syncStatus = 'synced';
              console.log('Created lawsuit:', advboxLawsuitId);
            }
          } catch (lawsuitError) {
            console.error('Error creating lawsuit, but customer was created:', lawsuitError);
            syncStatus = 'partial';
            syncError = `Cliente criado, mas erro ao criar processo: ${lawsuitError instanceof Error ? lawsuitError.message : String(lawsuitError)}`;
          }
        }
        
        if (!advboxCustomerId) {
          syncStatus = 'error';
          syncError = 'Não foi possível criar/encontrar cliente no ADVBOX';
        }
        
      } catch (advboxError) {
        console.error('Error syncing with ADVBOX:', advboxError);
        syncStatus = 'error';
        syncError = advboxError instanceof Error ? advboxError.message : String(advboxError);
      }
    }
    
    // 4. Registrar contrato no banco de dados (sempre, independente do status ADVBOX)
    const contractId = await registerContract(
      token,
      contractData,
      advboxCustomerId,
      advboxLawsuitId,
      syncStatus,
      syncError
    );
    
    console.log('Contract automation completed:', {
      contractId,
      advboxCustomerId,
      advboxLawsuitId,
      syncStatus,
    });
    
    return new Response(JSON.stringify({
      success: true,
      contractId,
      advboxCustomerId,
      advboxLawsuitId,
      syncStatus,
      syncError,
      message: syncStatus === 'synced' 
        ? 'Contrato registrado e sincronizado com ADVBOX com sucesso!'
        : syncStatus === 'partial'
        ? 'Contrato registrado. Cliente criado no ADVBOX, mas houve erro ao criar processo.'
        : 'Contrato registrado, mas não foi possível sincronizar com ADVBOX.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in contract automation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
