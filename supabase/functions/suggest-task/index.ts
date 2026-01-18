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

    const systemPrompt = `Você é um assistente jurídico especializado em análise de publicações e andamentos processuais brasileiros. Sua tarefa é analisar o conteúdo ESPECÍFICO de uma publicação/movimentação processual e sugerir uma tarefa DIRETAMENTE RELACIONADA ao que está descrito.

REGRAS CRÍTICAS:
1. A tarefa sugerida DEVE ser uma ação DIRETA em resposta ao conteúdo da publicação/movimentação
2. NÃO sugira tarefas genéricas - seja ESPECÍFICO para o caso
3. Identifique o tipo de movimentação (intimação, sentença, despacho, audiência, recurso, citação, etc.)
4. Sugira a PRÓXIMA AÇÃO PROCESSUAL que o advogado deve tomar

EXEMPLOS DE SUGESTÕES CORRETAS:
- Movimentação: "Designada audiência de instrução para 15/02/2024" → Tarefa: "Preparar documentos e testemunhas para audiência de instrução"
- Movimentação: "Proferida sentença procedente" → Tarefa: "Analisar sentença e comunicar cliente sobre resultado favorável" ou "Verificar prazo para recurso"
- Movimentação: "Intimação para manifestação sobre laudo pericial" → Tarefa: "Analisar laudo pericial e elaborar manifestação"
- Movimentação: "Designado julgamento pelo colegiado" → Tarefa: "Preparar sustentação oral" ou "Verificar pauta de julgamento"
- Movimentação: "Citação para contestar" → Tarefa: "Elaborar contestação"
- Movimentação: "Sentença improcedente" → Tarefa: "Analisar cabimento de recurso de apelação"
- Movimentação: "Despacho: Diga a parte autora" → Tarefa: "Elaborar petição de manifestação"
- Movimentação: "Juntada de AR positivo" → Tarefa: "Verificar início do prazo processual"

TIPOS DE TAREFA DISPONÍVEIS:
${taskTypesList}

Responda SEMPRE no formato JSON com a seguinte estrutura:
{
  "suggestedTaskType": "nome do tipo de tarefa mais adequado",
  "suggestedTaskTypeId": "id do tipo se disponível, ou null",
  "taskTitle": "título curto e descritivo ESPECÍFICO para esta movimentação",
  "taskDescription": "descrição detalhada do que precisa ser feito EM RESPOSTA a esta publicação específica",
  "suggestedDeadline": "data do prazo se identificada no texto (formato YYYY-MM-DD) ou null",
  "isUrgent": true/false,
  "isImportant": true/false,
  "reasoning": "explicação de POR QUE esta tarefa é necessária em resposta a esta movimentação"
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
