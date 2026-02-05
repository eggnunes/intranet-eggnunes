// Contract Automation Edge Function
// Registra contrato no banco de dados. A sincronização com ADVBOX ocorre após assinatura via webhook do ZapSign.

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
  comoConheceu?: string; // Campo "Como conheceu o escritório" preenchido pelo lead no formulário
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
  
  // Mapeamento de origem (do formulário ou utm_source) para possíveis nomes de origem no Advbox
  // Inclui as opções do formulário: Google, Instagram, Facebook, Grupos de Whatsapp, Indicação de terceiros
  const sourceToOriginMappings: Record<string, string[]> = {
    // Opções do formulário "Como conheceu o escritório?"
    'google': ['google', 'google ads', 'adwords', 'gads', 'busca'],
    'instagram': ['instagram', 'insta', 'ig', 'meta'],
    'facebook': ['facebook', 'fb', 'meta', 'face'],
    'grupos de whatsapp': ['whatsapp', 'whats', 'wpp', 'zap', 'grupo', 'grupos'],
    'indicação de terceiros': ['indicação', 'indicacao', 'referral', 'parceiro', 'terceiro', 'terceiros'],
    // Variações de UTM
    'fb': ['facebook', 'fb', 'meta', 'face'],
    'ig': ['instagram', 'insta', 'ig', 'meta'],
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
// Prioridade para origem: 1) comoConheceu do formulário, 2) utm_source do lead
async function getAdvboxSettings(clientEmail?: string, clientPhone?: string, comoConheceu?: string): Promise<AdvboxSettings> {
  const result: AdvboxSettings = {
    users: [],
    origins: [],
  };
  
  try {
    console.log('Fetching Advbox settings...');
    
    // Tentar buscar settings primeiro
    try {
      const response = await makeAdvboxRequest('/settings');
      const settings = response.data || response;
      console.log('Settings keys:', Object.keys(settings));
      
      // Extrair usuários
      if (settings.users && Array.isArray(settings.users)) {
        result.users = settings.users.map((u: any) => ({
          id: String(u.id || u.user_id || u.users_id),
          name: u.name || u.full_name || u.nome || u.email,
        })).filter((u: any) => u.id && u.id !== 'undefined');
        console.log(`Found ${result.users?.length} users from settings`);
      } else if (settings.account?.users && Array.isArray(settings.account.users)) {
        result.users = settings.account.users.map((u: any) => ({
          id: String(u.id || u.user_id || u.users_id),
          name: u.name || u.full_name || u.nome || u.email,
        })).filter((u: any) => u.id && u.id !== 'undefined');
        console.log(`Found ${result.users?.length} users from account`);
      }
      
      // Extrair origens de clientes
      if (settings.customers_origins && Array.isArray(settings.customers_origins)) {
        result.origins = settings.customers_origins.map((o: any) => ({
          id: String(o.id || o.customers_origins_id),
          name: o.name || o.origin || o.origem,
        })).filter((o: any) => o.id && o.id !== 'undefined');
        console.log(`Found ${result.origins?.length} customer origins from settings`);
      } else if (settings.account?.customers_origins && Array.isArray(settings.account.customers_origins)) {
        result.origins = settings.account.customers_origins.map((o: any) => ({
          id: String(o.id || o.customers_origins_id),
          name: o.name || o.origin || o.origem,
        })).filter((o: any) => o.id && o.id !== 'undefined');
        console.log(`Found ${result.origins?.length} customer origins from account`);
      }
    } catch (settingsError) {
      console.warn('Error fetching /settings, will try direct endpoints:', settingsError);
    }
    
    // Se não conseguiu usuários, buscar diretamente
    if (!result.users || result.users.length === 0) {
      try {
        console.log('Fetching users directly from /users endpoint...');
        await sleep(1000);
        const usersResponse = await makeAdvboxRequest('/users');
        const usersData = usersResponse.data || usersResponse;
        
        if (Array.isArray(usersData)) {
          result.users = usersData.map((u: any) => ({
            id: String(u.id || u.user_id || u.users_id),
            name: u.name || u.full_name || u.nome || u.email,
          })).filter((u: any) => u.id && u.id !== 'undefined');
          console.log(`Found ${result.users?.length} users from /users endpoint`);
        }
      } catch (usersError) {
        console.error('Error fetching /users:', usersError);
      }
    }
    
    // Se não conseguiu origens, buscar diretamente
    if (!result.origins || result.origins.length === 0) {
      try {
        console.log('Fetching origins directly from /customers_origins endpoint...');
        await sleep(1000);
        const originsResponse = await makeAdvboxRequest('/customers_origins');
        const originsData = originsResponse.data || originsResponse;
        
        if (Array.isArray(originsData)) {
          result.origins = originsData.map((o: any) => ({
            id: String(o.id || o.customers_origins_id),
            name: o.name || o.origin || o.origem,
          })).filter((o: any) => o.id && o.id !== 'undefined');
          console.log(`Found ${result.origins?.length} customer origins from /customers_origins endpoint`);
        }
      } catch (originsError) {
        console.error('Error fetching /customers_origins:', originsError);
      }
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
    } else {
      console.error('CRITICAL: No users found in Advbox! Cannot proceed with customer creation.');
    }
    
    // Buscar origem pelo campo "Como conheceu" do formulário OU pelo utm_source do tracking de leads
    if (result.origins && result.origins.length > 0) {
      let matchedOrigin: { id: string; name: string } | null = null;
      
      // PRIORIDADE 1: Usar o campo "Como conheceu o escritório" preenchido pelo lead no formulário
      if (comoConheceu && comoConheceu.trim() !== '') {
        console.log(`Campo "Como conheceu" preenchido pelo lead: "${comoConheceu}"`);
        matchedOrigin = findOriginByMarketingSource(result.origins, comoConheceu);
        
        if (matchedOrigin) {
          result.defaultOriginId = matchedOrigin.id;
          console.log(`Origem mapeada para "Como conheceu" "${comoConheceu}": ${result.defaultOriginId} (${matchedOrigin.name})`);
        }
      }
      
      // PRIORIDADE 2: Se "Como conheceu" está VAZIO, buscar origem na tabela de tracking de leads (captured_leads)
      // Isso busca pelo email/telefone do cliente na tabela captured_leads para encontrar o utm_source
      if (!matchedOrigin && (clientEmail || clientPhone)) {
        console.log('Campo "Como conheceu" vazio. Buscando origem na tabela de tracking de leads...');
        const utmSource = await getLeadMarketingSource(clientEmail, clientPhone);
        
        if (utmSource) {
          console.log(`Origem encontrada no tracking de leads: "${utmSource}"`);
          matchedOrigin = findOriginByMarketingSource(result.origins, utmSource);
          
          if (matchedOrigin) {
            result.defaultOriginId = matchedOrigin.id;
            console.log(`Origem mapeada do tracking para: ${result.defaultOriginId} (${matchedOrigin.name})`);
          }
        } else {
          console.log('Lead não encontrado na tabela de tracking (captured_leads)');
        }
      }
      
      // FALLBACK: Se não encontrar correspondência em nenhum lugar, usar "Não Informado"
      if (!matchedOrigin) {
        // Buscar especificamente a origem "não informado"
        const naoInformadoOrigin = result.origins.find((o: { id: string; name: string }) => 
          o.name.toLowerCase().includes('não informado') || 
          o.name.toLowerCase().includes('nao informado') ||
          o.name.toLowerCase() === 'não informado' ||
          o.name.toLowerCase() === 'nao informado'
        );
        
        if (naoInformadoOrigin) {
          result.defaultOriginId = naoInformadoOrigin.id;
          console.log(`Usando origem "Não Informado" como fallback: ${result.defaultOriginId} (${naoInformadoOrigin.name})`);
        } else {
          // Se "não informado" não existir, usar a primeira origem
          result.defaultOriginId = result.origins[0].id;
          console.log(`Origem "Não Informado" não encontrada, usando primeira origem como fallback: ${result.defaultOriginId} (${result.origins[0].name})`);
        }
      }
    } else {
      console.error('CRITICAL: No customer origins found in Advbox! Cannot proceed with customer creation.');
    }
    
    // Log settings para debug
    console.log('Final users available:', result.users?.length);
    console.log('Final origins available:', result.origins?.length);
    console.log('Default user ID:', result.defaultUserId);
    console.log('Default origin ID:', result.defaultOriginId);
    
    return result;
  } catch (error) {
    console.error('Error fetching Advbox settings:', error);
    return result;
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
    
    // VALIDAÇÃO: Verificar se temos os campos obrigatórios
    if (!settings.defaultUserId) {
      throw new Error('Responsável (users_id) é obrigatório mas não foi encontrado nas configurações do Advbox');
    }
    if (!settings.defaultOriginId) {
      throw new Error('Origem do cliente (customers_origins_id) é obrigatória mas não foi encontrada nas configurações do Advbox');
    }
    
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
    
    // Formatar endereço com número - OBRIGATÓRIO pelo Advbox
    let formattedStreet = formatStreet(client.rua, client.numero);
    // Se não tiver endereço, colocar um placeholder
    if (!formattedStreet || formattedStreet.trim() === '' || formattedStreet === ', S/N') {
      formattedStreet = 'Endereço não informado, S/N';
    }
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
      city: client.cidade || 'Não informado',
      street: formattedStreet, // Endereço formatado com número
      complement: client.complemento,
      neighborhood: client.bairro || 'Não informado',
      state: client.estado || 'MG',
      type: 'person', // pessoa física
      users_id: settings.defaultUserId, // OBRIGATÓRIO
      customers_origins_id: settings.defaultOriginId, // OBRIGATÓRIO
    };
    
    console.log('Customer payload:', JSON.stringify(customerData));
    
    const response = await makeAdvboxRequest('/customers', 'POST', customerData);
    
    console.log('Customer created successfully:', response);
    
    return { id: response.data?.id || response.id };
  } catch (error: any) {
    // Verificar se é erro de cliente duplicado
    if (error?.message?.includes('duplicate') || error?.message?.includes('already exists')) {
      console.log('Customer already exists, searching for existing customer...');
      // Tentar buscar o cliente existente
      const existing = await findExistingCustomer(client.cpf, client.nomeCompleto);
      if (existing) {
        console.log('Found existing customer:', existing.id);
        return { id: String(existing.id) };
      }
    }
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
  assinaturaStatus = 'not_sent'
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
    advbox_sync_status: 'pending',
    assinatura_status: assinaturaStatus,
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
    
    // Registrar contrato no banco de dados com status 'not_sent' (aguardando envio para assinatura)
    // A sincronização com ADVBox ocorrerá após a assinatura via webhook do ZapSign ou cadastro manual
    const contractId = await registerContract(
      token,
      contractData
    );
    
    console.log('Contract automation completed:', {
      contractId,
      assinaturaStatus: 'not_sent',
    });
    
    return new Response(JSON.stringify({
      success: true,
      contractId,
      message: 'Contrato registrado com sucesso! O cadastro no ADVBox será feito após a assinatura.',
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
