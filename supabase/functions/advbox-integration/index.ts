// Advbox Integration Edge Function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');

interface AdvboxRequestOptions {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
}

async function makeAdvboxRequest({ endpoint, method = 'GET', body }: AdvboxRequestOptions) {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  
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

  const response = await fetch(url, options);
  
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
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

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    throw new Error(`Falha ao fazer parse da resposta: ${responseText.substring(0, 200)}`);
  }
}

// Função para buscar todos os dados com paginação
async function fetchAllPaginated(endpoint: string, limit = 1000): Promise<any[]> {
  let allData: any[] = [];
  let page = 1;
  let hasMore = true;
  
  console.log(`Starting paginated fetch for: ${endpoint}`);
  
  while (hasMore) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    console.log('Advbox integration called:', path);

    switch (path) {
      // Dashboard de Processos
      case 'lawsuits': {
        console.log('Fetching all lawsuits with pagination...');
        const allLawsuits = await fetchAllPaginated('/lawsuits', 1000);
        
        return new Response(JSON.stringify({ data: allLawsuits }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'last-movements': {
        console.log('Fetching all movements with pagination...');
        const allMovements = await fetchAllPaginated('/last_movements', 1000);
        
        return new Response(JSON.stringify({ data: allMovements }), {
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
        const data = await makeAdvboxRequest({ endpoint: '/customers' });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'customer-birthdays': {
        const data = await makeAdvboxRequest({ endpoint: '/customers/birthdays' });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Publicações
      case 'recent-publications': {
        console.log('Fetching recent publications from movements...');
        // Buscar movimentações recentes que incluem publicações
        const allMovements = await fetchAllPaginated('/last_movements', 1000);
        
        // Filtrar apenas movimentações do tipo publicação
        const publications = allMovements.filter((movement: any) => 
          movement.type === 'publication' || 
          movement.description?.toLowerCase().includes('publicação') ||
          movement.description?.toLowerCase().includes('publicacao')
        );
        
        return new Response(JSON.stringify({ data: publications }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'publications': {
        const lawsuitId = url.searchParams.get('lawsuit_id');
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
        const data = await makeAdvboxRequest({ endpoint: '/posts' });
        return new Response(JSON.stringify(data), {
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

      // Transações Financeiras
      case 'transactions': {
        const data = await makeAdvboxRequest({ endpoint: '/transactions' });
        return new Response(JSON.stringify(data), {
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
