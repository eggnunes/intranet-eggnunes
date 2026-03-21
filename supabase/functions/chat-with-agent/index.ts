import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agentId, messages } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load agent
    const { data: agent, error: agentError } = await supabase
      .from("intranet_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) throw new Error("Agent not found");

    // Load knowledge base files (URLs/descriptions)
    const { data: files } = await supabase
      .from("intranet_agent_files")
      .select("file_name, file_type, file_url")
      .eq("agent_id", agentId);

    // Build system prompt
    let systemPrompt = `Você é "${agent.name}".

## Objetivo
${agent.objective}

## Instruções
${agent.instructions}`;

    if (files && files.length > 0) {
      systemPrompt += `\n\n## Base de Conhecimento\nVocê tem acesso aos seguintes documentos/recursos:\n`;
      for (const file of files) {
        systemPrompt += `- ${file.file_name} (${file.file_type})${file.file_type === 'link' ? `: ${file.file_url}` : ''}\n`;
      }
      systemPrompt += `\nUse essas informações como referência para suas respostas quando relevante.`;
    }

    const model = agent.model || "google/gemini-3-flash-preview";

    // Route to the correct provider
    if (model.startsWith("anthropic/")) {
      return await handleAnthropic(systemPrompt, messages, model);
    } else if (model.startsWith("perplexity/")) {
      return await handlePerplexity(systemPrompt, messages, model);
    } else {
      return await handleLovableGateway(systemPrompt, messages, model);
    }
  } catch (e) {
    console.error("chat-with-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleAnthropic(systemPrompt: string, messages: any[], model: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const anthropicModel = model === "anthropic/claude-sonnet" ? "claude-sonnet-4-20250514" : "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("Anthropic error:", response.status, t);
    throw new Error(`Anthropic error: ${response.status}`);
  }

  // Transform Anthropic SSE to OpenAI-compatible SSE
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              const openaiFormat = {
                choices: [{ delta: { content: parsed.delta.text } }]
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
            } else if (parsed.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch { /* skip */ }
        }
      }
    }
  });

  const transformed = response.body!.pipeThrough(transformStream);
  return new Response(transformed, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handlePerplexity(systemPrompt: string, messages: any[], _model: string) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`Perplexity error: ${response.status}`);
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handleLovableGateway(systemPrompt: string, messages: any[], model: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("Gateway error:", response.status, t);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
