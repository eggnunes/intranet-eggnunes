import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching jurisprudence for:', query);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente jurídico especializado em pesquisa de jurisprudência brasileira. 
Sua função é encontrar e apresentar decisões judiciais relevantes dos tribunais brasileiros (STF, STJ, TRFs, TJs estaduais, TST, TRTs).

Para cada pesquisa, você deve:
1. Buscar jurisprudências atuais e relevantes sobre o tema
2. Apresentar as decisões encontradas com: tribunal, número do processo/recurso, relator, data do julgamento, ementa resumida
3. Explicar brevemente a tese jurídica firmada em cada decisão
4. Indicar se há súmulas ou teses de repercussão geral relacionadas
5. Organizar as informações de forma clara e estruturada

Seja preciso nas citações e evite inventar decisões. Se não encontrar jurisprudência específica, informe isso claramente.
Sempre responda em português brasileiro.`
          },
          {
            role: 'user',
            content: `Pesquise jurisprudência sobre: ${query}`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 4000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'year',
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro na API: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || 'Nenhum resultado encontrado';

    console.log('Search completed successfully');

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-jurisprudence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
