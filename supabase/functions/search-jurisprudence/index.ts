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
    const { query, court } = await req.json();
    
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

    // Build court filter text
    let courtFilter = '';
    if (court && court !== 'todos') {
      const courtNames: Record<string, string> = {
        'STF': 'Supremo Tribunal Federal (STF)',
        'STJ': 'Superior Tribunal de Justiça (STJ)',
        'TST': 'Tribunal Superior do Trabalho (TST)',
        'TRF': 'Tribunais Regionais Federais (TRFs)',
        'TJ': 'Tribunais de Justiça Estaduais (TJs)',
        'TRT': 'Tribunais Regionais do Trabalho (TRTs)'
      };
      courtFilter = `Foque especificamente em decisões do ${courtNames[court] || court}.`;
    }

    console.log('Searching jurisprudence for:', query, 'Court:', court || 'todos');

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
Sua função é encontrar e apresentar decisões judiciais relevantes dos tribunais brasileiros.

${courtFilter}

IMPORTANTE: Para CADA decisão judicial encontrada, você DEVE retornar um JSON estruturado no seguinte formato:

{
  "jurisprudencias": [
    {
      "tribunal": "Nome do tribunal (STF, STJ, TRF1, TJSP, etc)",
      "numero_processo": "Número do processo/recurso completo",
      "relator": "Nome do relator",
      "data_julgamento": "Data do julgamento",
      "ementa": "EMENTA COMPLETA da decisão - transcreva integralmente",
      "resumo": "Breve resumo explicativo da tese jurídica firmada (2-3 parágrafos)",
      "area_direito": "civil|trabalhista|penal|tributario|administrativo|constitucional|previdenciario|consumidor|ambiental|empresarial|outro",
      "tese_firmada": "A tese jurídica principal firmada na decisão",
      "sumulas_relacionadas": "Súmulas ou teses de repercussão geral relacionadas (se houver)"
    }
  ],
  "observacoes_gerais": "Observações gerais sobre os resultados encontrados"
}

REGRAS:
1. Busque entre 3 a 6 jurisprudências relevantes sobre o tema
2. Sempre transcreva a EMENTA COMPLETA de cada decisão
3. Inclua o resumo explicativo separadamente
4. Classifique corretamente a área do direito
5. Se não encontrar jurisprudência específica, retorne o JSON com array vazio e explique nas observações
6. Retorne APENAS o JSON, sem texto adicional antes ou depois
7. Seja preciso nas citações - não invente decisões`
          },
          {
            role: 'user',
            content: `Pesquise jurisprudência sobre: ${query}`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 8000,
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
    const rawResult = data.choices?.[0]?.message?.content || '';

    console.log('Search completed successfully');

    // Try to parse as JSON
    let parsedResult = null;
    try {
      // Find JSON in the response
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log('Could not parse as JSON, returning raw result');
    }

    return new Response(
      JSON.stringify({ 
        result: rawResult,
        parsed: parsedResult 
      }),
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
