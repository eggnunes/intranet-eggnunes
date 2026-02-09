import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name } = await req.json();
    if (!file_base64 || !file_name) {
      return new Response(JSON.stringify({ error: "Arquivo não fornecido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ext = file_name.split(".").pop()?.toLowerCase();
    const mimeType = ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    // Step 1: Extract text using Gemini Flash (multimodal)
    console.log("Step 1: Extracting text from document...");
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia TODO o texto deste documento de forma fiel, mantendo a estrutura de parágrafos. Retorne apenas o texto extraído, sem comentários adicionais.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${file_base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!extractResponse.ok) {
      const status = extractResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes para processar o documento." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await extractResponse.text();
      console.error("Extract error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro ao extrair texto do documento." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.choices?.[0]?.message?.content;

    if (!extractedText || extractedText.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair texto suficiente do documento." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Text extracted: ${extractedText.length} chars`);

    // Step 2: Analyze grammar using Gemini Pro with tool calling
    console.log("Step 2: Analyzing grammar...");
    const analyzeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Você é um revisor especialista em língua portuguesa brasileira (norma culta). Sua tarefa é analisar o texto fornecido e identificar TODOS os erros gramaticais, ortográficos e de estilo.

Regras:
- Categorize cada erro em: ortografia, concordancia, regencia, pontuacao, crase, acentuacao, coesao, outro
- IGNORE nomes próprios, termos jurídicos técnicos, citações legais, números de processos e artigos de lei
- Indique a localização aproximada (ex: "parágrafo 1", "início do texto", "página 2")
- NÃO corrija o texto, apenas liste os erros encontrados
- Para cada erro, forneça o trecho exato, a descrição do erro, a sugestão de correção e a localização
- Seja preciso e minucioso, mas não invente erros inexistentes
- Se não houver erros, retorne uma lista vazia`,
          },
          {
            role: "user",
            content: `Analise o seguinte texto e identifique todos os erros de português:\n\n${extractedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_errors",
              description: "Reporta a lista de erros de português encontrados no texto.",
              parameters: {
                type: "object",
                properties: {
                  erros: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trecho: { type: "string", description: "O trecho exato do texto que contém o erro" },
                        erro: { type: "string", description: "Descrição clara do erro gramatical" },
                        tipo: {
                          type: "string",
                          enum: ["ortografia", "concordancia", "regencia", "pontuacao", "crase", "acentuacao", "coesao", "outro"],
                          description: "Categoria do erro",
                        },
                        sugestao: { type: "string", description: "Como o trecho deveria estar escrito" },
                        localizacao: { type: "string", description: "Localização aproximada no texto (ex: parágrafo 3)" },
                      },
                      required: ["trecho", "erro", "tipo", "sugestao", "localizacao"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["erros"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_errors" } },
      }),
    });

    if (!analyzeResponse.ok) {
      const status = analyzeResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes para análise gramatical." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await analyzeResponse.text();
      console.error("Analyze error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro ao analisar gramática do texto." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analyzeData = await analyzeResponse.json();
    
    // Parse tool call response
    const toolCall = analyzeData.choices?.[0]?.message?.tool_calls?.[0];
    let erros: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        erros = parsed.erros || [];
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    console.log(`Analysis complete: ${erros.length} errors found`);

    return new Response(JSON.stringify({ erros }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-portuguese error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
