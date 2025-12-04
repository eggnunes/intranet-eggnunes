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
    const { messages, model, attachments, options } = await req.json();

    if (!messages || messages.length === 0) {
      throw new Error('Mensagens são obrigatórias');
    }

    let response;

    // Route to appropriate provider based on model
    if (model === 'perplexity') {
      response = await handlePerplexity(messages, options);
    } else if (model === 'manus') {
      response = await handleManus(messages, attachments);
    } else if (model.startsWith('gpt')) {
      response = await handleOpenAI(messages, model, attachments, options);
    } else {
      // Default to Lovable AI (Gemini models)
      response = await handleLovableAI(messages, model, attachments, options);
    }

    return new Response(JSON.stringify(response), {
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

async function handleLovableAI(messages: any[], model: string, attachments: any[], options: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

  const modelMap: Record<string, string> = {
    'gemini-flash': 'google/gemini-2.5-flash',
    'gemini-pro': 'google/gemini-2.5-pro',
  };

  const systemPrompt = `Você é um assistente de IA útil e prestativo. Responda em português brasileiro de forma clara e profissional.
Se receber arquivos anexados, analise-os cuidadosamente.
Seja conciso mas completo em suas respostas.`;

  // Build messages with attachments
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any, index: number) => {
      if (index === messages.length - 1 && attachments && attachments.length > 0) {
        // Add attachment info to last user message
        const attachmentInfo = attachments.map((a: any) => `[Arquivo anexado: ${a.name}]`).join('\n');
        return { role: m.role, content: `${m.content}\n\n${attachmentInfo}` };
      }
      return { role: m.role, content: m.content };
    })
  ];

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelMap[model] || 'google/gemini-2.5-flash',
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    }
    if (response.status === 402) {
      throw new Error('Créditos insuficientes. Entre em contato com o administrador.');
    }
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error('Erro ao comunicar com a IA');
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || 'Sem resposta',
  };
}

async function handleOpenAI(messages: any[], model: string, attachments: any[], options: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

  const modelMap: Record<string, string> = {
    'gpt-5': 'gpt-4o',
    'gpt-5-mini': 'gpt-4o-mini',
  };

  const systemPrompt = `Você é um assistente de IA útil e prestativo. Responda em português brasileiro de forma clara e profissional.
Se receber arquivos anexados, analise-os cuidadosamente.
Seja conciso mas completo em suas respostas.`;

  // Check if image generation is requested
  if (options?.enableImageGen && messages[messages.length - 1]?.content?.toLowerCase().includes('image')) {
    return await generateImage(messages[messages.length - 1].content, OPENAI_API_KEY);
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({ role: m.role, content: m.content }))
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelMap[model] || 'gpt-4o-mini',
      messages: formattedMessages,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI error:', response.status, errorText);
    throw new Error('Erro ao comunicar com a OpenAI');
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || 'Sem resposta',
  };
}

async function generateImage(prompt: string, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!response.ok) {
    throw new Error('Erro ao gerar imagem');
  }

  const data = await response.json();
  return {
    content: 'Imagem gerada com sucesso!',
    images: data.data?.map((img: any) => img.url) || [],
  };
}

async function handlePerplexity(messages: any[], options: any) {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY não configurada');

  const systemPrompt = `Você é um assistente de pesquisa especializado. Responda em português brasileiro.
Sempre cite suas fontes quando possível.
Forneça informações atualizadas e precisas.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity error:', response.status, errorText);
    throw new Error('Erro ao comunicar com Perplexity');
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || 'Sem resposta',
  };
}

async function handleManus(messages: any[], attachments: any[]) {
  const MANUS_API_KEY = Deno.env.get('MANUS_API_KEY');
  if (!MANUS_API_KEY) throw new Error('MANUS_API_KEY não configurada');

  // Manus API integration
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
  return {
    content: data.response || data.message || data.content || 'Sem resposta',
  };
}
