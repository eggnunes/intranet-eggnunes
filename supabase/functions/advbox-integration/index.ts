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
// Função para buscar todos os dados com paginação COMPLETA
// IMPORTANTE: A API Advbox usa limit=100 máximo e offset para paginação (não page)
async function fetchAllPaginatedComplete(
  endpoint: string, 
  cacheKey: string,
  limit = 100, // API aceita máximo de 100
  maxIterations = 100
): Promise<{ items: any[]; totalCount: number; pagesLoaded: number }> {
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;
  let totalCount = 0;
  let iterations = 0;
  
  console.log(`Starting COMPLETE paginated fetch for: ${endpoint}`);
  fetchStatus.set(cacheKey, { inProgress: true, startedAt: Date.now(), progress: 'Iniciando...' });
  
  try {
    while (hasMore && iterations < maxIterations) {
      // Aguardar antes de cada request para evitar rate limit
      if (iterations > 0) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
      
      fetchStatus.set(cacheKey, { 
        inProgress: true, 
        startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
        progress: `Buscando (offset=${offset})... (${allData.length} itens carregados)` 
      });
      
      const response = await makeAdvboxRequest({ 
        endpoint: `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}` 
      });
      
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;
      
      // Log all field names from first item to debug date fields
      if (iterations === 0 && items.length > 0) {
        console.log(`[DEBUG] Sample item fields:`, Object.keys(items[0]));
        console.log(`[DEBUG] Sample item date fields:`, JSON.stringify({
          process_date: items[0].process_date,
          created_at: items[0].created_at,
        }));
        // Log full first item to see all available fields
        console.log(`[DEBUG] Full first item:`, JSON.stringify(items[0]).substring(0, 2000));
      }
      
      console.log(`Iteration ${iterations + 1} (offset=${offset}): fetched ${items.length} items (total so far: ${allData.length + items.length}/${totalCount})`);
      
      if (items.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(items);
        offset += items.length;
        iterations++;
        
        // Se retornou menos que o limite ou já temos todos, não há mais páginas
        if (items.length < limit || allData.length >= totalCount) {
          hasMore = false;
        }
      }
    }
    
    console.log(`COMPLETE fetch finished: ${allData.length} items in ${iterations} iterations`);
    fetchStatus.set(cacheKey, { 
      inProgress: false, 
      startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
      progress: `Completo: ${allData.length} itens carregados` 
    });
    
    return { items: allData, totalCount, pagesLoaded: iterations };
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
    // Security: Verify user is authenticated and approved
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify user with Supabase Auth
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY!,
      },
    });

    if (!userResponse.ok) {
      console.error('Failed to verify user token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) {
      console.error('No user ID in token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is approved - use the user's token for RLS policies
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=approval_status,is_active`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles.length === 0) {
        console.error('User profile not found:', userId);
        return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const profile = profiles[0];
      if (profile.approval_status !== 'approved' || !profile.is_active) {
        console.error('User not approved or inactive:', userId, profile.approval_status, profile.is_active);
        return new Response(JSON.stringify({ error: 'Acesso não autorizado. Aguarde aprovação do administrador.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.error('Failed to fetch user profile');
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User verified:', userId);

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

      // Endpoint para buscar processos recentes por data
      // ESTRATÉGIA: Buscar TODOS os processos com paginação completa e filtrar
      // A API Advbox retorna processos ordenados por ID (mais antigo primeiro),
      // então precisamos buscar tudo para encontrar os recentes
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

        const now = Date.now();
        const startDateObj = new Date(startDate + 'T00:00:00Z');
        const endDateObj = endDate ? new Date(endDate + 'T23:59:59Z') : new Date();
        
        // PRIORIDADE 1: Usar cache completo se disponível
        const fullCacheKey = 'lawsuits-full';
        let allLawsuits: any[] = [];
        let apiTotalCount = 0;
        let fromCache = false;
        let cacheAge = 0;
        let dataSource = 'none';
        
        const fullCached = cache.get(fullCacheKey);
        
        // Verificar cache completo (pode ter mais dados)
        if (fullCached) {
          const cachedItems = extractItems(fullCached.data);
          // Usar cache se tiver dados significativos (mais de 5000 = provavelmente completo)
          if (cachedItems.length > 5000) {
            allLawsuits = cachedItems;
            apiTotalCount = extractTotalCount(fullCached.data, cachedItems.length);
            fromCache = true;
            cacheAge = Math.floor((now - fullCached.timestamp) / 1000);
            dataSource = 'full-cache';
            console.log(`Using lawsuits-full cache: ${allLawsuits.length} items (age: ${cacheAge}s)`);
          }
        }
        
        // PRIORIDADE 2: Se não tem cache completo, buscar TUDO da API
        if (allLawsuits.length === 0) {
          console.log('No complete cache found, fetching ALL lawsuits from API...');
          try {
            // Buscar todos os processos com paginação completa
            const result = await fetchAllPaginatedComplete('/lawsuits', 'lawsuits-recent-temp', 1000, 50);
            allLawsuits = result.items;
            apiTotalCount = result.totalCount;
            dataSource = 'api-full';
            console.log(`Fetched ALL ${allLawsuits.length} lawsuits from API`);
            
            // Salvar no cache completo para uso futuro
            cache.set(fullCacheKey, { 
              data: { items: allLawsuits, totalCount: apiTotalCount },
              timestamp: now,
            });
          } catch (error) {
            console.error('Error fetching all lawsuits:', error);
            // Fallback: tentar usar qualquer cache disponível
            if (fullCached) {
              allLawsuits = extractItems(fullCached.data);
              apiTotalCount = extractTotalCount(fullCached.data, allLawsuits.length);
              fromCache = true;
              cacheAge = Math.floor((now - fullCached.timestamp) / 1000);
              dataSource = 'full-cache-fallback';
            }
          }
        }
        
        // FILTRAR os processos pela data
        const filteredLawsuits = allLawsuits.filter((lawsuit: any) => {
          let processDate: Date | null = null;
          
          // Priorizar process_date (data real do processo)
          if (lawsuit.process_date) {
            const parsed = new Date(lawsuit.process_date);
            if (!isNaN(parsed.getTime())) processDate = parsed;
          }
          // Fallback para created_at
          if (!processDate && lawsuit.created_at) {
            const parsed = new Date(lawsuit.created_at.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) processDate = parsed;
          }
          
          if (!processDate) return false;
          
          return processDate >= startDateObj && processDate <= endDateObj;
        });
        
        console.log(`Filtered ${filteredLawsuits.length} lawsuits from ${startDate} to ${endDate || 'now'} (from ${allLawsuits.length} total, source: ${dataSource})`);
        
        // Log sample para debug
        if (filteredLawsuits.length > 0) {
          const sample = filteredLawsuits.slice(0, 5).map((item: any) => ({
            id: item.id,
            process_date: item.process_date,
            created_at: item.created_at,
          }));
          console.log('[DEBUG] Sample filtered lawsuits:', JSON.stringify(sample));
        } else {
          // Debug: mostrar distribuição de datas para entender o problema
          const dateDistribution: Record<string, number> = {};
          allLawsuits.forEach((l: any) => {
            const date = l.process_date || l.created_at;
            if (date) {
              const yearMonth = date.substring(0, 7);
              dateDistribution[yearMonth] = (dateDistribution[yearMonth] || 0) + 1;
            }
          });
          const recentMonths = Object.entries(dateDistribution)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 10);
          console.log('[DEBUG] Most recent months in data:', recentMonths);
        }
        
        return new Response(JSON.stringify({
          data: filteredLawsuits,
          totalCount: filteredLawsuits.length,
          apiTotalCount,
          startDate,
          endDate,
          dataSource,
          metadata: {
            fromCache,
            rateLimited: false,
            cacheAge,
            filteredFromTotal: allLawsuits.length,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Endpoint rápido - busca apenas primeira página (para carregamento inicial)
      // NOTA: A API tem limit máximo de 100, usamos offset para paginação
      case 'lawsuits': {
        console.log('Fetching lawsuits first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'lawsuits-first-page',
          async () => {
            // Buscar primeira página (limit=100 é o máximo da API)
            const response = await makeAdvboxRequest({ endpoint: '/lawsuits?limit=100&offset=0' });
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
      
      // Endpoint para buscar TODAS as movimentações com paginação completa
      case 'movements-full': {
        console.log('Fetching ALL movements with complete pagination...');
        const cacheKey = 'movements-full';
        
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for movements-full: ${items.length} items`);
          
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
        
        try {
          // Buscar TODAS as movimentações com paginação completa (até 100 páginas = 10.000 movimentações)
          const result = await fetchAllPaginatedComplete('/last_movements', cacheKey, 100, 100);
          
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
      
      case 'last-movements': {
        console.log('Fetching movements first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'last-movements-first-page',
          async () => {
            // Buscar primeira página (limit=100 é o máximo da API)
            const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=100&offset=0' });
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

      case 'task-types': {
        // A API Advbox não tem endpoint específico para tipos de tarefa
        // Tentamos buscar do endpoint /settings que pode conter configurações
        console.log('Fetching task types from settings...');
        try {
          const settingsResult = await makeAdvboxRequest({ endpoint: '/settings' });
          console.log('Settings response keys:', Object.keys(settingsResult));
          
          // Verificar se settings contém tasks ou task_types
          const settings = settingsResult.data || settingsResult;
          let taskTypes: { id: number | string; name: string }[] = [];
          
          // Tentar extrair tipos de tarefa de diferentes locais possíveis
          if (settings.tasks && Array.isArray(settings.tasks)) {
            console.log('Found tasks in settings, count:', settings.tasks.length);
            // Log sample item to debug structure
            if (settings.tasks.length > 0) {
              console.log('Sample task type from settings:', JSON.stringify(settings.tasks[0]));
              console.log('All task type keys:', Object.keys(settings.tasks[0]));
            }
            
            // Map task types correctly - Advbox settings.tasks usa campo 'id' como identificador
            // mas pode ter outro campo como o identificador real de tipo
            taskTypes = settings.tasks.map((t: any) => {
              // Priorizar tasks_id se existir, senão usar id
              const taskTypeId = t.tasks_id ?? t.task_id ?? t.id;
              return {
                id: taskTypeId,
                name: t.task || t.name || t.title || `Tipo ${taskTypeId}`,
              };
            }).filter((t: any) => t.id != null && t.name);
            
            console.log('Mapped task types (first 5):', JSON.stringify(taskTypes.slice(0, 5)));
          } else if (settings.task_types && Array.isArray(settings.task_types)) {
            console.log('Found task_types in settings');
            taskTypes = settings.task_types.map((t: any) => ({
              id: t.tasks_id ?? t.task_id ?? t.id,
              name: t.task || t.name || t.title || `Tipo ${t.id}`,
            })).filter((t: any) => t.id != null && t.name);
          } else if (settings.account?.tasks) {
            console.log('Found account.tasks in settings');
            const accountTasks = Array.isArray(settings.account.tasks) ? settings.account.tasks : [];
            taskTypes = accountTasks.map((t: any) => ({
              id: t.tasks_id ?? t.task_id ?? t.id,
              name: t.task || t.name || t.title || `Tipo ${t.id}`,
            })).filter((t: any) => t.id != null && t.name);
          } else if (settings.account) {
            console.log('Settings account keys:', Object.keys(settings.account));
          }
          
          if (taskTypes.length > 0) {
            return new Response(JSON.stringify({ data: taskTypes, source: 'settings' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Se não encontrou em settings, tentar extrair de tarefas existentes
          console.log('No task types in settings, extracting from existing posts...');
          const postsResult = await getCachedOrFetch('tasks', async () => {
            return await makeAdvboxRequest({ endpoint: '/posts' });
          }, false);
          
          const posts = postsResult.data?.data || postsResult.data || [];
          const uniqueTaskTypes = new Map();
          
          if (Array.isArray(posts) && posts.length > 0) {
            // Log first post structure for debugging
            const firstPost = posts[0];
            console.log('First post keys:', Object.keys(firstPost));
            console.log('First post preview:', JSON.stringify(firstPost).substring(0, 500));
            
            posts.forEach((post: any) => {
              // Tentar várias formas de extrair o tipo de tarefa
              if (post.tasks_id && post.task_name) {
                uniqueTaskTypes.set(String(post.tasks_id), {
                  id: String(post.tasks_id),
                  name: post.task_name,
                });
              } else if (post.task?.id && post.task?.name) {
                uniqueTaskTypes.set(String(post.task.id), {
                  id: String(post.task.id),
                  name: post.task.name,
                });
              } else if (post.tasks_id && post.task) {
                uniqueTaskTypes.set(String(post.tasks_id), {
                  id: String(post.tasks_id),
                  name: post.task,
                });
              } else if (post.type_id && post.type_name) {
                uniqueTaskTypes.set(String(post.type_id), {
                  id: String(post.type_id),
                  name: post.type_name,
                });
              }
            });
          }
          
          const extractedTypes = Array.from(uniqueTaskTypes.values());
          console.log(`Extracted ${extractedTypes.length} unique task types from ${posts.length} posts`);
          
          return new Response(JSON.stringify({ 
            data: extractedTypes, 
            source: 'posts',
            totalPosts: posts.length,
            samplePostKeys: Array.isArray(posts) && posts.length > 0 ? Object.keys(posts[0]) : [],
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching task types:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch task types', 
            details: error instanceof Error ? error.message : String(error),
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'settings': {
        // Endpoint para buscar configurações da conta
        const result = await getCachedOrFetch('settings', async () => {
          return await makeAdvboxRequest({ endpoint: '/settings' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'users': {
        // Buscar usuários do Advbox via settings
        console.log('Fetching users from settings...');
        try {
          const settingsResult = await getCachedOrFetch('settings', async () => {
            return await makeAdvboxRequest({ endpoint: '/settings' });
          }, forceRefresh);
          
          const settings = settingsResult.data?.data || settingsResult.data || settingsResult;
          console.log('Settings keys for users:', Object.keys(settings));
          
          let users: any[] = [];
          
          // Tentar extrair usuários de diferentes locais possíveis
          if (settings.users && Array.isArray(settings.users)) {
            users = settings.users;
            console.log(`Found ${users.length} users in settings.users`);
          } else if (settings.account?.users && Array.isArray(settings.account.users)) {
            users = settings.account.users;
            console.log(`Found ${users.length} users in settings.account.users`);
          } else if (settings.members && Array.isArray(settings.members)) {
            users = settings.members;
            console.log(`Found ${users.length} users in settings.members`);
          } else if (settings.account?.members && Array.isArray(settings.account.members)) {
            users = settings.account.members;
            console.log(`Found ${users.length} users in settings.account.members`);
          } else if (settings.responsibles && Array.isArray(settings.responsibles)) {
            users = settings.responsibles;
            console.log(`Found ${users.length} users in settings.responsibles`);
          } else {
            // Log available keys for debugging
            console.log('No users array found. Available settings keys:', 
              JSON.stringify(Object.keys(settings)).substring(0, 500));
            if (settings.account) {
              console.log('Account keys:', JSON.stringify(Object.keys(settings.account)).substring(0, 500));
            }
          }
          
          // Normalizar formato dos usuários
          const normalizedUsers = users.map((u: any) => ({
            id: u.id || u.user_id || u.member_id,
            name: u.name || u.full_name || u.nome || u.email || `Usuário ${u.id || u.user_id}`,
            email: u.email,
          })).filter((u: any) => u.id);
          
          return new Response(JSON.stringify({ 
            data: normalizedUsers, 
            source: 'settings',
            rawCount: users.length,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching users:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch users',
            details: error instanceof Error ? error.message : String(error),
            data: [],
          }), {
            status: 200, // Return 200 with empty array so frontend can fallback
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'create-task': {
        const body = await req.json();
        console.log('Creating task with body:', JSON.stringify(body));
        
        // Nota: tasks_id é requerido pelo Advbox mas o endpoint /tasks não está acessível
        // Se não foi fornecido, tentar criar sem ele (o Advbox pode usar um padrão)
        
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
        // Aceitar parâmetros de data para filtrar transações recentes
        let startDate = url.searchParams.get('start_date');
        let endDate = url.searchParams.get('end_date');
        
        // Tentar ler do body se não veio na URL
        if (!startDate && req.method === 'POST') {
          try {
            const body = await req.json();
            startDate = body.start_date;
            endDate = body.end_date;
          } catch (e) {
            // Ignorar erro de parse
          }
        }
        
        // Se não tem filtro de data, usar padrão de 12 meses
        if (!startDate) {
          const now = new Date();
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          startDate = oneYearAgo.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
        }
        
        console.log(`Fetching transactions from ${startDate} to ${endDate || 'now'}`);
        
        const cacheKey = `transactions-${startDate}-${endDate || 'now'}`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
          // Usar filtros de data na API do Advbox
          let endpoint = '/transactions?limit=1000';
          if (startDate) {
            endpoint += `&date_due_start=${startDate}`;
          }
          if (endDate) {
            endpoint += `&date_due_end=${endDate}`;
          }
          console.log('Transactions endpoint:', endpoint);
          return await makeAdvboxRequest({ endpoint });
        }, forceRefresh);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Endpoint para transações recentes (últimos N meses) - COM PAGINAÇÃO COMPLETA
      case 'transactions-recent': {
        const months = parseInt(url.searchParams.get('months') || '12');
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = now.toISOString().split('T')[0];
        
        console.log(`Fetching transactions for last ${months} months: ${startDateStr} to ${endDateStr}`);
        
        const cacheKey = `transactions-recent-${months}m`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
          // Fazer paginação COMPLETA para buscar TODAS as transações do período
          let allTransactions: any[] = [];
          let offset = 0;
          const limit = 100; // API Advbox aceita máximo de 100 por página
          let hasMore = true;
          let totalCount = 0;
          let iterations = 0;
          const maxIterations = 100; // Máximo de 10.000 transações
          
          console.log('Starting paginated fetch for transactions...');
          
          while (hasMore && iterations < maxIterations) {
            // Delay entre requests para evitar rate limit
            if (iterations > 0) {
              await sleep(DELAY_BETWEEN_REQUESTS);
            }
            
            const endpoint = `/transactions?limit=${limit}&offset=${offset}&date_due_start=${startDateStr}&date_due_end=${endDateStr}`;
            console.log(`Transactions fetch iteration ${iterations + 1}: offset=${offset}`);
            
            const response = await makeAdvboxRequest({ endpoint });
            const items = response?.data || [];
            totalCount = response?.totalCount || totalCount;
            
            if (items.length === 0) {
              hasMore = false;
            } else {
              allTransactions = [...allTransactions, ...items];
              offset += limit;
              
              // Se retornou menos que o limit, não há mais páginas
              if (items.length < limit) {
                hasMore = false;
              }
            }
            
            iterations++;
            console.log(`Loaded ${allTransactions.length} transactions so far (totalCount: ${totalCount})`);
          }
          
          console.log(`[TRANSACTIONS] Finished loading ${allTransactions.length} transactions in ${iterations} iterations`);
          
          // Debug: log sample transaction
          if (allTransactions.length > 0) {
            console.log('[DEBUG] First transaction keys:', Object.keys(allTransactions[0]));
            console.log('[DEBUG] Sample transaction fields:', JSON.stringify({
              id: allTransactions[0].id,
              name: allTransactions[0].name,
              identification: allTransactions[0].identification,
              customer_name: allTransactions[0].customer_name,
              description: allTransactions[0].description,
              date_due: allTransactions[0].date_due,
              date_payment: allTransactions[0].date_payment,
              amount: allTransactions[0].amount,
              category: allTransactions[0].category,
            }));
          }
          
          return {
            data: allTransactions,
            totalCount: allTransactions.length,
            offset: 0,
            limit: allTransactions.length,
          };
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
