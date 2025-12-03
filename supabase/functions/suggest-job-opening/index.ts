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
    const { title, position } = await req.json();
    
    if (!title && !position) {
      return new Response(
        JSON.stringify({ error: 'Título ou cargo é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const positionLabels: Record<string, string> = {
      'socio': 'Sócio',
      'advogado': 'Advogado',
      'estagiario': 'Estagiário de Direito',
      'comercial': 'Comercial',
      'administrativo': 'Administrativo'
    };

    const positionLabel = positionLabels[position] || position;

    const systemPrompt = `Você é um especialista em RH de um escritório de advocacia brasileiro especializado em direito imobiliário, do consumidor e bancário.

Sua tarefa é gerar uma descrição de vaga e requisitos profissionais para uma vaga de emprego.

O escritório é o Egg Nunes Advogados, localizado em Goiânia-GO, com foco em:
- Direito Imobiliário (especialmente multipropriedade/timeshare, rescisão de multas abusivas, atrasos em obras)
- Direito do Consumidor
- Direito Bancário

Responda APENAS em formato JSON válido com a seguinte estrutura:
{
  "description": "Descrição detalhada da vaga com responsabilidades e atividades",
  "requirements": "Lista de requisitos e qualificações necessárias"
}

Seja profissional, objetivo e específico para o contexto de um escritório de advocacia.`;

    const userPrompt = `Gere descrição e requisitos para a seguinte vaga:

Título da Vaga: ${title || 'Não especificado'}
Cargo: ${positionLabel}

Considere:
- Para cargos jurídicos (advogado, estagiário): inclua conhecimentos em direito imobiliário, do consumidor e bancário
- Para cargos administrativos: foque em organização, atendimento e suporte ao escritório
- Para cargos comerciais: foque em captação de clientes e relacionamento

Gere uma descrição atraente e requisitos realistas para o mercado jurídico de Goiânia.`;

    console.log('Calling Lovable AI for job opening suggestions...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', content);

    // Parse JSON from response
    let suggestion = { description: '', requirements: '' };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback: try to extract content manually
      suggestion = {
        description: `Vaga para ${positionLabel} no escritório Egg Nunes Advogados. Atuação em direito imobiliário, do consumidor e bancário.`,
        requirements: `Formação em Direito. Conhecimento em direito imobiliário e do consumidor. Boa comunicação e organização.`
      };
    }

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-job-opening:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar sugestões';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
