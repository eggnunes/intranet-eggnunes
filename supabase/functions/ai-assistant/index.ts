import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `Você é um assistente de IA útil e prestativo. Responda em português brasileiro de forma clara e profissional.
Se receber arquivos anexados, analise-os cuidadosamente.
Seja conciso mas completo em suas respostas.`;

// All models now route through Lovable Cloud gateway
const MODEL_MAP: Record<string, string> = {
  // Gemini models
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-flash-lite': 'google/gemini-2.5-flash-lite',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gemini-3-pro': 'google/gemini-3.1-pro-preview',
  // OpenAI models (routed through gateway)
  'gpt-5.2': 'openai/gpt-5.2',
  'gpt-4o': 'openai/gpt-5',
  'gpt-4o-mini': 'openai/gpt-5-mini',
  'openai-o3': 'openai/gpt-5',
  'openai-o4-mini': 'openai/gpt-5-mini',
  'lovable-gpt-5': 'openai/gpt-5',
  'lovable-gpt-5-mini': 'openai/gpt-5-mini',
  'lovable-gpt-5-nano': 'openai/gpt-5-nano',
  // Perplexity models (updated names, direct API for web search)
  'perplexity-small': 'sonar',
  'perplexity-large': 'sonar-pro',
  'perplexity-huge': 'sonar-reasoning',
};

function formatMessages(messages: any[], attachments?: any[]) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m: any, index: number) => {
      if (index === messages.length - 1 && attachments && attachments.length > 0) {
        const attachmentInfo = attachments.map((a: any) => `[Arquivo anexado: ${a.name}]`).join('\n');
        return { role: m.role, content: `${m.content}\n\n${attachmentInfo}` };
      }
      return { role: m.role, content: m.content };
    })
  ];
}

function isPerplexityModel(model: string): boolean {
  return model.startsWith('perplexity-');
}

function isManusModel(model: string): boolean {
  return model === 'manus';
}

async function callGateway(messages: any[], model: string, stream: boolean = false) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

  const resolvedModel = MODEL_MAP[model] || 'google/gemini-2.5-flash';
  console.log('Gateway request:', { requestedModel: model, resolvedModel, stream });

  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: resolvedModel, messages, stream }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    }
    if (response.status === 402) {
      throw new Error('Créditos insuficientes. Entre em contato com o administrador.');
    }
    const errorText = await response.text();
    console.error('Gateway error:', response.status, errorText);
    throw new Error('Erro ao comunicar com a IA');
  }

  return response;
}

async function callPerplexity(messages: any[], model: string, stream: boolean = false) {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY não configurada');

  const resolvedModel = MODEL_MAP[model] || 'sonar-pro';

  const systemPrompt = `Você é um assistente de pesquisa especializado. Responda em português brasileiro.
Sempre cite suas fontes quando possível.
Forneça informações atualizadas e precisas.`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({ role: m.role, content: m.content }))
  ];

  console.log('Perplexity request:', { requestedModel: model, resolvedModel, stream });

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: formattedMessages,
      temperature: 0.2,
      ...(stream ? { stream: true } : { max_tokens: 4096 }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Perplexity');
  }

  return response;
}

async function callManus(messages: any[]) {
  const MANUS_API_KEY = Deno.env.get('MANUS_API_KEY');
  if (!MANUS_API_KEY) throw new Error('MANUS_API_KEY não configurada');

  const lastMessage = messages[messages.length - 1]?.content || '';

  const response = await fetch('https://api.manus.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MANUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: lastMessage,
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role,
        content: m.content
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Manus error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Manus AI');
  }

  const data = await response.json();
  return { content: data.response || data.message || data.content || 'Sem resposta' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, attachments, options, stream } = await req.json();

    if (!messages || messages.length === 0) {
      throw new Error('Mensagens são obrigatórias');
    }

    // Streaming request
    if (stream) {
      const formattedMessages = formatMessages(messages, attachments);

      let response: Response;
      if (isPerplexityModel(model)) {
        response = await callPerplexity(messages, model, true);
      } else {
        response = await callGateway(formattedMessages, model, true);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Non-streaming request
    let result: { content: string; images?: string[] };

    if (isManusModel(model)) {
      result = await callManus(messages);
    } else if (isPerplexityModel(model)) {
      const response = await callPerplexity(messages, model);
      const data = await response.json();
      result = { content: data.choices?.[0]?.message?.content || 'Sem resposta' };
    } else {
      const formattedMessages = formatMessages(messages, attachments);
      const response = await callGateway(formattedMessages, model);
      const data = await response.json();
      result = { content: data.choices?.[0]?.message?.content || 'Sem resposta' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('AI Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({
      error: errorMessage,
      content: `Desculpe, ocorreu um erro: ${errorMessage}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
