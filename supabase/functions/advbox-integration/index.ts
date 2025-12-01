// Advbox Integration Edge Function - Complete Data Fetch

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

// Status de operações em andamento
const fetchStatus = new Map<string, { inProgress: boolean; startedAt: number; progress: string; error?: string }>();

// Valores padrão caso não consiga buscar do banco
let CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let DELAY_BETWEEN_REQUESTS = 1500; // 1.5s entre cada request para evitar rate limit

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
        DELAY_BETWEEN_REQUESTS = Math.max(data[0].delay_between_requests_ms, 1000); // Mínimo 1s
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
  const maxRetries = 5;
  
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
    
    console.log('Response status:', response.status);
    
    // Se recebeu 429 (Too Many Requests), aguardar e tentar novamente
    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
      await sleep(waitTime);
      return makeAdvboxRequest({ endpoint, method, body }, retryCount + 1);
    }
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Advbox API error:', response.status, responseText.substring(0, 200));
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

// Função para buscar todos os dados com paginação COMPLETA
async function fetchAllPaginatedComplete(
  endpoint: string, 
  cacheKey: string,
  limit = 1000, 
  maxPages = 100
): Promise<{ items: any[]; totalCount: number; pagesLoaded: number }> {
  let allData: any[] = [];
  let page = 1;
  let hasMore = true;
  let totalCount = 0;
  
  console.log(`Starting COMPLETE paginated fetch for: ${endpoint}`);
  fetchStatus.set(cacheKey, { inProgress: true, startedAt: Date.now(), progress: 'Iniciando...' });
  
  try {
    while (hasMore && page <= maxPages) {
      // Aguardar antes de cada request para evitar rate limit
      if (page > 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
      
      fetchStatus.set(cacheKey, { 
        inProgress: true, 
        startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
        progress: `Buscando página ${page}... (${allData.length} itens carregados)` 
      });
      
      const response = await makeAdvboxRequest({ 
        endpoint: `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&page=${page}` 
      });
      
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;
      
      // Log all field names from first item to debug date fields
      if (page === 1 && items.length > 0) {
        console.log(`[DEBUG] Sample item fields:`, Object.keys(items[0]));
        console.log(`[DEBUG] Sample item date fields:`, JSON.stringify({
          process_date: items[0].process_date,
          created_at: items[0].created_at,
          data_processo_inicio: items[0].data_processo_inicio,
          data_inicio: items[0].data_inicio,
          start_date: items[0].start_date,
          date: items[0].date,
          distribution_date: items[0].distribution_date,
          data_distribuicao: items[0].data_distribuicao,
        }));
        // Log full first item to see all available fields
        console.log(`[DEBUG] Full first item:`, JSON.stringify(items[0]).substring(0, 2000));
      }
      
      console.log(`Page ${page}: fetched ${items.length} items (total so far: ${allData.length + items.length}/${totalCount})`);
      
      if (items.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(items);
        
        // Se retornou menos que o limite ou já temos todos, não há mais páginas
        if (items.length < limit || allData.length >= totalCount) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }
    
    console.log(`COMPLETE fetch finished: ${allData.length} items in ${page} pages`);
    fetchStatus.set(cacheKey, { 
      inProgress: false, 
      startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
      progress: `Completo: ${allData.length} itens carregados` 
    });
    
    return { items: allData, totalCount, pagesLoaded: page };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error during paginated fetch for ${cacheKey}:`, errorMsg);
    fetchStatus.set(cacheKey, { 
      inProgress: false, 
      startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
      progress: `Erro: ${errorMsg.substring(0, 100)}`,
      error: errorMsg
    });
    throw error;
  }
}

// Função para obter dados do cache ou buscar da API
async function getCachedOrFetch(
  cacheKey: string, 
  fetchFn: () => Promise<any>, 
  forceRefresh = false
): Promise<{ data: any; metadata: { fromCache: boolean; rateLimited: boolean; cacheAge: number } }> {
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
    
    // Verificar se é um erro transiente (rate limit ou erros de servidor)
    const isTransientError = 
      message.includes('429') || 
      message.includes('502') || 
      message.includes('503') || 
      message.includes('504') ||
      message.includes('500') ||
      message.includes('Bad gateway');

    if (isTransientError) {
      console.warn(`Transient error for ${cacheKey}: ${message.substring(0, 100)}`);
      // SEMPRE retornar cache se existir, independente da idade
      if (cached) {
        console.warn(`Returning cached data (age: ${Math.floor((now - cached.timestamp) / 1000)}s) for ${cacheKey} due to transient error.`);
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

// Helper para extrair items de diferentes formatos de cache
function extractItems(cachedData: any): any[] {
  if (Array.isArray(cachedData)) return cachedData;
  if (Array.isArray(cachedData?.items)) return cachedData.items;
  if (Array.isArray(cachedData?.data)) return cachedData.data;
  return [];
}

// Helper para extrair totalCount de diferentes formatos
function extractTotalCount(cachedData: any, fallback: number): number {
  if (!cachedData) return fallback;
  return cachedData.totalCount ?? cachedData.total ?? cachedData.count ?? fallback;
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
      // ========== PROCESSOS (LAWSUITS) ==========
      
      // Endpoint COMPLETO - busca TODOS os processos com paginação
      case 'lawsuits-full': {
        console.log('Fetching ALL lawsuits with complete pagination...');
        const cacheKey = 'lawsuits-full';
        
        // Verificar se já temos dados completos em cache
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for lawsuits-full: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            isComplete: items.length >= totalCount,
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Buscar todos os processos com paginação completa
        try {
          const result = await fetchAllPaginatedComplete('/lawsuits', cacheKey, 1000, 50);
          
          // Salvar no cache
          cache.set(cacheKey, { 
            data: { items: result.items, totalCount: result.totalCount },
            timestamp: now,
          });
          
          return new Response(JSON.stringify({
            data: result.items,
            totalCount: result.totalCount,
            pagesLoaded: result.pagesLoaded,
            isComplete: result.items.length >= result.totalCount,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          // Se falhar, retornar cache existente se disponível
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: items,
              totalCount,
              isComplete: items.length >= totalCount,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }

      // Endpoint para buscar processos recentes por data de início
      case 'lawsuits-recent': {
        const startDate = url.searchParams.get('start_date'); // formato: YYYY-MM-DD
        const endDate = url.searchParams.get('end_date'); // formato: YYYY-MM-DD (opcional)
        
        console.log(`Fetching RECENT lawsuits from ${startDate} to ${endDate || 'now'}...`);
        
        if (!startDate) {
          return new Response(JSON.stringify({ 
            error: 'start_date is required (format: YYYY-MM-DD)' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const cacheKey = `lawsuits-recent-${startDate}-${endDate || 'now'}`;
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for lawsuits-recent: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            startDate,
            endDate,
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          // Usar o parâmetro data_processo_inicio da API do Advbox
          let endpoint = `/lawsuits?limit=1000&page=1&data_processo_inicio=${startDate}`;
          if (endDate) {
            endpoint += `&data_processo_fim=${endDate}`;
          }
          
          console.log(`Making request with date filter: ${endpoint}`);
          const response = await makeAdvboxRequest({ endpoint });
          
          const items = Array.isArray(response.data) ? response.data : [];
          const totalCount = typeof response.totalCount === 'number' ? response.totalCount : items.length;
          
          console.log(`Found ${items.length} lawsuits with start date >= ${startDate}`);
          
          // Log sample of returned items to verify date filtering
          if (items.length > 0) {
            const sample = items.slice(0, 3).map((item: any) => ({
              id: item.id,
              process_date: item.process_date,
              created_at: item.created_at,
              data_processo_inicio: item.data_processo_inicio,
              distribution_date: item.distribution_date,
            }));
            console.log('[DEBUG] Sample recent lawsuits:', JSON.stringify(sample));
          }

          // Salvar no cache
          cache.set(cacheKey, { 
            data: { items, totalCount },
            timestamp: now,
          });
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            startDate,
            endDate,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching recent lawsuits:', error);
          
          // Retornar cache existente se disponível
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: items,
              totalCount,
              startDate,
              endDate,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }

      // Endpoint rápido - busca apenas primeira página (para carregamento inicial)
      case 'lawsuits': {
        console.log('Fetching lawsuits first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'lawsuits-first-page',
          async () => {
            const response = await makeAdvboxRequest({ endpoint: '/lawsuits?limit=1000&page=1' });
            const items = Array.isArray(response.data) ? response.data : [];
            const totalCount = typeof response.totalCount === 'number' ? response.totalCount : items.length;
            return { items, totalCount };
          },
          forceRefresh
        );

        const items = extractItems(rawResult.data);
        const totalCount = extractTotalCount(rawResult.data, items.length);

        return new Response(JSON.stringify({
          data: items,
          metadata: rawResult.metadata,
          totalCount,
          isPartial: items.length < totalCount,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== MOVIMENTAÇÕES ==========
      
      case 'last-movements': {
        console.log('Fetching movements first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'last-movements-first-page',
          async () => {
            const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=1000&page=1' });
            const items = Array.isArray(response.data) ? response.data : [];
            const totalCount = typeof response.totalCount === 'number' ? response.totalCount : items.length;
            return { items, totalCount };
          },
          forceRefresh
        );

        const items = extractItems(rawResult.data);
        const totalCount = extractTotalCount(rawResult.data, items.length);

        return new Response(JSON.stringify({
          data: items,
          metadata: rawResult.metadata,
          totalCount,
        }), {
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

      // ========== CLIENTES E ANIVERSÁRIOS ==========
      
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

      // ========== PUBLICAÇÕES ==========
      
      case 'recent-publications': {
        console.log('Fetching recent publications from movements...');
        const result = await getCachedOrFetch('last-movements', async () => {
          // Buscar com paginação para ter mais publicações
          const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=1000&page=1' });
          return response.data || [];
        }, forceRefresh);
        
        // Filtrar apenas movimentações do tipo publicação
        const allData = extractItems(result.data);
        const publications = allData.filter((movement: any) => 
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

      // ========== TAREFAS (POSTS) ==========
      
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

      // ========== TRANSAÇÕES FINANCEIRAS ==========
      
      case 'transactions': {
        const result = await getCachedOrFetch('transactions', async () => {
          return await makeAdvboxRequest({ endpoint: '/transactions' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== STATUS E CONTROLE ==========
      
      case 'fetch-status': {
        const statusKey = url.searchParams.get('key') || 'lawsuits-full';
        const status = fetchStatus.get(statusKey);
        return new Response(JSON.stringify({
          key: statusKey,
          status: status || { inProgress: false, progress: 'Nenhuma operação em andamento' },
        }), {
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
