// Edge Function para sugerir tarefas usando IA baseado no conteúdo da publicação/movimentação

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface SuggestTaskRequest {
  publicationContent: string;
  processNumber?: string;
  customerName?: string;
  court?: string;
  taskTypes?: { id: string | number; name: string }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não está configurada');
    }

    const body: SuggestTaskRequest = await req.json();
    const { publicationContent, processNumber, customerName, court, taskTypes } = body;

    if (!publicationContent) {
      return new Response(JSON.stringify({ error: 'publicationContent é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing publication for task suggestion:', publicationContent.substring(0, 200));

    // Construir lista de tipos de tarefa disponíveis
    const taskTypesList = taskTypes?.length 
      ? taskTypes.map(t => `- ${t.id}: ${t.name}`).join('\n')
      : `- audiência
- prazo
- intimação
- sentença
- recurso
- despacho
- petição
- diligência
- perícia
- outro`;

    const systemPrompt = `Você é um assistente jurídico especializado em análise de publicações e andamentos processuais. Sua tarefa é analisar o conteúdo de uma publicação/movimentação processual e sugerir uma tarefa apropriada para o advogado responsável.

REGRAS:
1. Analise o texto da publicação para identificar o tipo de movimentação (intimação, sentença, despacho, audiência, etc.)
2. Identifique prazos mencionados no texto
3. Sugira uma tarefa específica e acionável
4. Se houver data de audiência ou prazo mencionado, extraia essa data
5. Seja conciso e objetivo

TIPOS DE TAREFA DISPONÍVEIS:
${taskTypesList}

Responda SEMPRE no formato JSON com a seguinte estrutura:
{
  "suggestedTaskType": "nome do tipo de tarefa mais adequado",
  "suggestedTaskTypeId": "id do tipo se disponível, ou null",
  "taskTitle": "título curto e descritivo para a tarefa",
  "taskDescription": "descrição detalhada do que precisa ser feito",
  "suggestedDeadline": "data do prazo se identificada no texto (formato YYYY-MM-DD) ou null",
  "isUrgent": true/false,
  "isImportant": true/false,
  "reasoning": "breve explicação do porquê desta sugestão"
}`;

    const userPrompt = `Analise esta publicação/movimentação processual e sugira uma tarefa:

PROCESSO: ${processNumber || 'Não informado'}
CLIENTE: ${customerName || 'Não informado'}  
TRIBUNAL: ${court || 'Não informado'}

CONTEÚDO DA PUBLICAÇÃO:
${publicationContent}

Responda APENAS com o JSON, sem texto adicional.`;

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Créditos insuficientes. Por favor, adicione créditos à sua conta.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response:', content);

    // Tentar extrair JSON da resposta
    let suggestion;
    try {
      // Remover possíveis marcadores de código
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestion = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Retornar sugestão padrão
      suggestion = {
        suggestedTaskType: 'Análise de publicação',
        suggestedTaskTypeId: null,
        taskTitle: `Analisar publicação - ${processNumber || 'Processo'}`,
        taskDescription: `Verificar e tomar providências sobre a publicação recente do processo.`,
        suggestedDeadline: null,
        isUrgent: false,
        isImportant: true,
        reasoning: 'Sugestão padrão - não foi possível analisar o conteúdo automaticamente.',
      };
    }

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-task function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
