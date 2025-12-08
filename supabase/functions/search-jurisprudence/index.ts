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
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente jurídico especializado em pesquisa de jurisprudência brasileira.
Sua função é encontrar e apresentar decisões judiciais relevantes dos tribunais brasileiros.

${courtFilter}

Para cada decisão encontrada, retorne um JSON estruturado:

{
  "jurisprudencias": [
    {
      "tribunal": "Nome do tribunal",
      "numero_processo": "Número do processo",
      "relator": "Nome do relator",
      "data_julgamento": "Data do julgamento",
      "ementa": "Ementa da decisão",
      "resumo": "Resumo da tese jurídica",
      "area_direito": "civil|trabalhista|penal|tributario|administrativo|constitucional|previdenciario|consumidor|ambiental|empresarial|outro",
      "tese_firmada": "Tese jurídica principal"
    }
  ],
  "observacoes_gerais": "Observações sobre os resultados"
}

REGRAS:
1. Busque 3 a 5 jurisprudências relevantes
2. Retorne APENAS o JSON, sem texto adicional
3. Seja preciso nas citações`
          },
          {
            role: 'user',
            content: `Pesquise jurisprudência sobre: ${query}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        return_images: false,
        return_related_questions: false
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
