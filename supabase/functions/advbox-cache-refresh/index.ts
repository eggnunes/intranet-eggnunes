import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify that the request comes from an authorized source (cron job with service role key)
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  
  if (authHeader !== expectedToken) {
    console.error('Unauthorized access attempt to advbox-cache-refresh');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Iniciando atualização automática do cache do Advbox');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Lista de endpoints para atualizar
    const endpoints = [
      'lawsuits',
      'customers', 
      'publications',
      'tasks',
      'transactions'
    ];

    const results = {
      timestamp: new Date().toISOString(),
      success: [] as string[],
      errors: [] as { endpoint: string; error: string }[],
    };

    // Fazer requisições diretas para a edge function advbox-integration
    for (const endpoint of endpoints) {
      try {
        console.log(`Atualizando cache: ${endpoint}`);
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/advbox-integration/${endpoint}?force_refresh=true`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        const data = await response.json();

        if (!response.ok) {
          console.error(`Erro ao atualizar ${endpoint}:`, data);
          results.errors.push({ endpoint, error: data.error || 'Erro desconhecido' });
        } else {
          console.log(`Cache atualizado com sucesso: ${endpoint}`);
          results.success.push(endpoint);
        }

        // Pequeno delay entre requisições para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Exceção ao atualizar ${endpoint}:`, errorMessage);
        results.errors.push({ endpoint, error: errorMessage });
      }
    }

    console.log('Atualização do cache concluída:', results);

    return new Response(
      JSON.stringify({
        message: 'Atualização do cache do Advbox concluída',
        results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na atualização do cache:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
