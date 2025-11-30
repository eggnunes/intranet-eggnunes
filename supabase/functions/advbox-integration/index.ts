// Advbox Integration Edge Function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://api.softwareadvbox.com.br';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');

interface AdvboxRequestOptions {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
}

async function makeAdvboxRequest({ endpoint, method = 'GET', body }: AdvboxRequestOptions) {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  
  console.log(`Making ${method} request to Advbox:`, url);
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${ADVBOX_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Advbox API error:', response.status, errorText);
    throw new Error(`Advbox API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
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
        const data = await makeAdvboxRequest({ endpoint: '/lawsuits' });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'last-movements': {
        const data = await makeAdvboxRequest({ endpoint: '/last_movements' });
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
