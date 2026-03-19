import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, cpf, tipo_acao, descricao_caso, data_nascimento, telefone, email, endereco } = await req.json();

    if (!nome || !tipo_acao || !descricao_caso) {
      return new Response(
        JSON.stringify({ error: "Nome, tipo de ação e descrição do caso são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const systemPrompt = `Você é um advogado especialista em análise de viabilidade jurídica no Brasil. 
Analise os dados do cliente e do caso apresentado e forneça um parecer estruturado.

Seu parecer DEVE seguir exatamente este formato:

**RECOMENDAÇÃO:** [VIÁVEL | INVIÁVEL | NECESSITA MAIS DADOS]

**RESUMO:**
[Resumo em 2-3 frases sobre a viabilidade do caso]

**PONTOS FAVORÁVEIS:**
- [Ponto 1]
- [Ponto 2]

**PONTOS DE ATENÇÃO:**
- [Ponto 1]
- [Ponto 2]

**FUNDAMENTAÇÃO LEGAL:**
[Breve fundamentação com base legal aplicável]

**PRÓXIMOS PASSOS RECOMENDADOS:**
- [Passo 1]
- [Passo 2]

Seja objetivo, técnico e profissional. Considere a legislação brasileira vigente.`;

    const userPrompt = `Analise a viabilidade do seguinte caso:

**DADOS DO CLIENTE:**
- Nome: ${nome}
- CPF: ${cpf || "Não informado"}
- Data de Nascimento: ${data_nascimento || "Não informada"}
- Telefone: ${telefone || "Não informado"}
- Email: ${email || "Não informado"}
- Endereço: ${endereco || "Não informado"}

**TIPO DE AÇÃO:** ${tipo_acao}

**DESCRIÇÃO DO CASO:**
${descricao_caso}

Forneça seu parecer de viabilidade jurídica.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Erro de autenticação com a API Anthropic." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar análise de viabilidade." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const parecer = data.content?.[0]?.text || "Não foi possível gerar o parecer.";

    // Extract recommendation from parecer
    let recomendacao = "necessita_mais_dados";
    const upperParecer = parecer.toUpperCase();
    if (upperParecer.includes("**RECOMENDAÇÃO:** VIÁVEL") || upperParecer.includes("RECOMENDAÇÃO:** VIÁVEL")) {
      recomendacao = "viavel";
    } else if (upperParecer.includes("**RECOMENDAÇÃO:** INVIÁVEL") || upperParecer.includes("RECOMENDAÇÃO:** INVIÁVEL")) {
      recomendacao = "inviavel";
    }

    return new Response(
      JSON.stringify({ parecer, recomendacao }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-viability error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
