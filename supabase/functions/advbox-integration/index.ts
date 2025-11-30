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
