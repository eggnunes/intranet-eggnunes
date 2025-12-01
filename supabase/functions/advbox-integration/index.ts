// Advbox Integration Edge Function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Cache simples em memória (válido durante a vida da instância)
const cache = new Map<string, { data: any; timestamp: number; fromCache?: boolean; rateLimited?: boolean }>();

// Valores padrão caso não consiga buscar do banco
let CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let DELAY_BETWEEN_REQUESTS = 500; // 500ms entre cada request

// Buscar configurações do banco
async function loadSettings() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/advbox_settings?select=*&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        CACHE_TTL = data[0].cache_ttl_minutes * 60 * 1000;
        DELAY_BETWEEN_REQUESTS = data[0].delay_between_requests_ms;
        console.log(`Settings loaded: cache_ttl=${CACHE_TTL}ms, delay=${DELAY_BETWEEN_REQUESTS}ms`);
      }
    }
  } catch (error) {
    console.warn('Failed to load settings, using defaults:', error);
  }
}

// Carregar configurações ao iniciar
loadSettings();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface AdvboxRequestOptions {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
}

async function makeAdvboxRequest({ endpoint, method = 'GET', body }: AdvboxRequestOptions, retryCount = 0): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 3;
  
  console.log(`Making ${method} request to Advbox:`, url);
  console.log('Using token:', ADVBOX_TOKEN ? 'Token configured' : 'NO TOKEN');
  
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
    
    console.log('Response status:', response.status);
    
    // Se recebeu 429 (Too Many Requests), aguardar e tentar novamente
    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
      await sleep(waitTime);
      return makeAdvboxRequest({ endpoint, method, body }, retryCount + 1);
    }
    
    const responseText = await response.text();
    console.log('Response body (first 500 chars):', responseText.substring(0, 500));
    
    if (!response.ok) {
      console.error('Advbox API error:', response.status, responseText);
      throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    // Verificar se a resposta é JSON válido
    if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
      console.error('Response is not JSON:', responseText.substring(0, 200));
      throw new Error(`API retornou HTML em vez de JSON. Verifique o endpoint e o token de autenticação.`);
    }

    return JSON.parse(responseText);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Advbox API error')) {
      throw e;
    }
    console.error('Failed to parse JSON:', e);
    throw new Error(`Falha ao fazer parse da resposta`);
  }
}

// Função para buscar todos os dados com paginação (com throttling)
async function fetchAllPaginated(endpoint: string, limit = 1000): Promise<any[]> {
  let allData: any[] = [];
  let page = 1;
  let hasMore = true;
  
  console.log(`Starting paginated fetch for: ${endpoint}`);
  
  while (hasMore) {
    // Aguardar antes de cada request para evitar rate limit
    if (page > 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
    
    const response = await makeAdvboxRequest({ 
      endpoint: `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&page=${page}` 
    });
    
    const items = response.data || [];
    console.log(`Page ${page}: fetched ${items.length} items`);
    
    if (items.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(items);
      
      // Se retornou menos que o limite, não há mais páginas
      if (items.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }
    
    // Limite de segurança: não buscar mais de 50 páginas
    if (page > 50) {
      console.warn('Reached maximum page limit (50)');
      hasMore = false;
    }
  }
  
  console.log(`Total fetched: ${allData.length} items`);
  return allData;
}

// Função para obter dados do cache ou buscar da API
async function getCachedOrFetch(cacheKey: string, fetchFn: () => Promise<any>, forceRefresh = false): Promise<{ data: any; metadata: { fromCache: boolean; rateLimited: boolean; cacheAge: number } }> {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  
  // Se forçar refresh, ignorar cache fresco e tentar buscar
  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for: ${cacheKey}`);
    return {
      data: cached.data,
      metadata: {
        fromCache: true,
        rateLimited: false,
        cacheAge: Math.floor((now - cached.timestamp) / 1000),
      },
    };
  }
  
  // Tentar buscar da API
  console.log(`Cache miss or stale for: ${cacheKey}, fetching from API`);

  try {
    const data = await fetchFn();
    // Armazenar no cache com timestamp atual
    cache.set(cacheKey, { data, timestamp: now, fromCache: false, rateLimited: false });
    return {
      data,
      metadata: {
        fromCache: false,
        rateLimited: false,
        cacheAge: 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('429')) {
      console.warn(`Rate limited for ${cacheKey}.`);
      // SEMPRE retornar cache se existir, independente da idade
      if (cached) {
        console.warn(`Returning cached data (age: ${Math.floor((now - cached.timestamp) / 1000)}s) for ${cacheKey} due to rate limit.`);
        return {
          data: cached.data,
          metadata: {
            fromCache: true,
            rateLimited: true,
            cacheAge: Math.floor((now - cached.timestamp) / 1000),
          },
        };
      }
      console.warn(`No cache available for ${cacheKey}. Returning empty result.`);
      return {
        data: [],
        metadata: {
          fromCache: false,
          rateLimited: true,
          cacheAge: 0,
        },
      };
    }

    console.error(`Error fetching data for ${cacheKey}:`, message);
    // Para outros erros, também retornar cache se existir
    if (cached) {
      console.warn(`Returning cached data due to error for ${cacheKey}.`);
      return {
        data: cached.data,
        metadata: {
          fromCache: true,
          rateLimited: false,
          cacheAge: Math.floor((now - cached.timestamp) / 1000),
        },
      };
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';

    console.log('Advbox integration called:', path, 'force_refresh:', forceRefresh);

    switch (path) {
      // Dashboard de Processos
      case 'lawsuits': {
        console.log('Fetching lawsuits first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'lawsuits-first-page',
          async () => {
            const response = await makeAdvboxRequest({ endpoint: '/lawsuits?limit=1000&page=1' });
            const items = Array.isArray(response.data) ? response.data : [];
            const totalCount =
              typeof response.totalCount === 'number' ? response.totalCount : items.length;
            return { items, totalCount };
          },
          forceRefresh
        );

        // Suporta formatos antigos de cache em que "data" era apenas um array
        const cachedData: any = rawResult.data;
        const items: any[] = Array.isArray(cachedData)
          ? cachedData
          : Array.isArray(cachedData?.items)
          ? cachedData.items
          : Array.isArray(cachedData?.data)
          ? cachedData.data
          : [];

        const totalCount =
          (cachedData && (cachedData.totalCount ?? cachedData.total ?? cachedData.count)) ??
          items.length;

        const responseBody = {
          data: items,
          metadata: rawResult.metadata,
          totalCount,
        };

        return new Response(JSON.stringify(responseBody), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'last-movements': {
        console.log('Fetching all movements with pagination...');
        const result = await getCachedOrFetch('last-movements', async () => {
          return await fetchAllPaginated('/last_movements', 1000);
        }, forceRefresh);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'lawsuit-by-id': {
        let lawsuitId = url.searchParams.get('lawsuit_id') || url.searchParams.get('id');

        if (!lawsuitId && req.method !== 'OPTIONS') {
          try {
            const body = await req.json();
            if (body && typeof body === 'object' && 'lawsuit_id' in body) {
              lawsuitId = String((body as any).lawsuit_id);
            }
          } catch (err) {
            console.warn('Failed to parse body for lawsuit-by-id endpoint:', err);
          }
        }

        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ endpoint: `/lawsuits/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'movements': {
        const lawsuitId = url.searchParams.get('lawsuit_id');
        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const data = await makeAdvboxRequest({ endpoint: `/movements/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Clientes e Aniversários
      case 'customers': {
        const result = await getCachedOrFetch('customers', async () => {
          return await makeAdvboxRequest({ endpoint: '/customers' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'customer-birthdays': {
        const result = await getCachedOrFetch('customer-birthdays', async () => {
          return await makeAdvboxRequest({ endpoint: '/customers/birthdays' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Publicações
      case 'recent-publications': {
        console.log('Fetching recent publications from movements...');
        const result = await getCachedOrFetch('last-movements', async () => {
          return await fetchAllPaginated('/last_movements', 1000);
        }, forceRefresh);
        
        // Filtrar apenas movimentações do tipo publicação
        const publications = result.data.filter((movement: any) => 
          movement.type === 'publication' || 
          movement.description?.toLowerCase().includes('publicação') ||
          movement.description?.toLowerCase().includes('publicacao')
        );
        
        return new Response(JSON.stringify({ 
          data: publications, 
          metadata: result.metadata 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'publications': {
        let lawsuitId = url.searchParams.get('lawsuit_id');

        if (!lawsuitId && req.method !== 'OPTIONS') {
          try {
            const body = await req.json();
            if (body && typeof body === 'object' && 'lawsuit_id' in body) {
              lawsuitId = String((body as any).lawsuit_id);
            }
          } catch (err) {
            console.warn('Failed to parse body for publications endpoint:', err);
          }
        }

        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ endpoint: `/publications/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Tarefas (Posts)
      case 'tasks': {
        const result = await getCachedOrFetch('tasks', async () => {
          return await makeAdvboxRequest({ endpoint: '/posts' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-task': {
        const body = await req.json();
        const data = await makeAdvboxRequest({ 
          endpoint: '/posts', 
          method: 'POST',
          body 
        });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-task': {
        const body = await req.json();
        const { task_id, ...updateData } = body;
        
        if (!task_id) {
          return new Response(JSON.stringify({ error: 'Task ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ 
          endpoint: `/posts/${task_id}`, 
          method: 'PUT',
          body: updateData 
        });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'complete-task': {
        const body = await req.json();
        const data = await makeAdvboxRequest({ 
          endpoint: `/posts/${body.task_id}/complete`, 
          method: 'POST'
        });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Transações Financeiras
      case 'transactions': {
        const result = await getCachedOrFetch('transactions', async () => {
          return await makeAdvboxRequest({ endpoint: '/transactions' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in advbox-integration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
