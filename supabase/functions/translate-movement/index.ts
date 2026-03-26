import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { title, titles } = await req.json();
    
    const titlesToTranslate: string[] = titles || (title ? [title] : []);
    
    if (titlesToTranslate.length === 0) {
      throw new Error('No titles provided');
    }

    const translations: { original: string; translated: string }[] = [];

    // Process in batches of 10 for efficiency
    const batchSize = 10;
    for (let i = 0; i < titlesToTranslate.length; i += batchSize) {
      const batch = titlesToTranslate.slice(i, i + batchSize);
      
      const prompt = batch.length === 1
        ? `Traduza este andamento processual jurídico para linguagem simples e humanizada, sem termos técnicos, para que um cliente leigo entenda o que aconteceu no processo dele. Seja claro e direto, em no máximo 2 frases curtas.

Andamento: "${batch[0]}"

Responda APENAS com a tradução, sem aspas nem explicações adicionais.`
        : `Traduza cada um dos andamentos processuais jurídicos abaixo para linguagem simples e humanizada, sem termos técnicos, para que um cliente leigo entenda o que aconteceu no processo dele. Seja claro e direto, em no máximo 2 frases curtas para cada.

${batch.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}

Responda no formato:
1. [tradução]
2. [tradução]
...

Sem aspas, sem explicações adicionais.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic error:', response.status, errorText);
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      if (batch.length === 1) {
        translations.push({ original: batch[0], translated: content.trim() });
      } else {
        const lines = content.split('\n').filter((l: string) => l.trim());
        batch.forEach((original, idx) => {
          const line = lines[idx] || '';
          const translated = line.replace(/^\d+\.\s*/, '').trim();
          translations.push({ original, translated: translated || 'Tradução não disponível' });
        });
      }
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
