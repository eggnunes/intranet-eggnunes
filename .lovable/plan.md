

# Otimização das integrações de IA: Lovable Cloud para tarefas complexas

## Diagnóstico atual

Analisei todas as 16 Edge Functions que usam IA no projeto. A maioria já usa o Lovable Cloud (gateway), mas há oportunidades de melhoria em duas áreas:

### 1. Assistente de IA chama OpenAI e Perplexity diretamente
A função `ai-assistant` faz chamadas diretas para `api.openai.com` e `api.perplexity.ai` em vez de passar pelo gateway do Lovable Cloud. Isso significa que os modelos GPT e Perplexity não se beneficiam do gerenciamento automático de tokens e rate limiting do gateway. Além disso, os nomes dos modelos Perplexity estão desatualizados (`llama-3.1-sonar-*` em vez dos atuais `sonar`/`sonar-pro`).

### 2. Tarefas jurídicas complexas usam modelos leves
Duas funções que fazem análise jurídica profunda usam `gemini-2.5-flash` (modelo rápido/leve), quando se beneficiariam de modelos com raciocínio mais forte:
- **analyze-viability** — parecer de viabilidade jurídica (análise complexa de caso)
- **suggest-petition** — sugestão de petições com fundamentação legal

### O que NÃO será alterado (e por quê)
- **search-jurisprudence** — permanece no Perplexity `sonar-pro` porque precisa de busca web em tempo real para encontrar jurisprudências reais
- **voice-to-text** — permanece no OpenAI Whisper (é um serviço de transcrição de áudio, sem equivalente no gateway)
- Funções simples como `suggest-food-category`, `generate-chat-message` — já estão bem dimensionadas com `gemini-2.5-flash`

## Alterações

### Arquivo 1: `supabase/functions/ai-assistant/index.ts`
- Rotear chamadas OpenAI (GPT-5, o3, o4-mini) pelo gateway Lovable Cloud em vez de chamar `api.openai.com` diretamente
- Atualizar modelos Perplexity para nomes atuais (`sonar`, `sonar-pro`, `sonar-reasoning`)
- Rotear Perplexity pelo gateway quando disponível, mantendo fallback direto para busca web
- Manter Manus como está (API separada)

### Arquivo 2: `supabase/functions/analyze-viability/index.ts`
- Trocar modelo de `google/gemini-2.5-flash` para `google/gemini-2.5-pro` (melhor raciocínio jurídico)

### Arquivo 3: `supabase/functions/suggest-petition/index.ts`
- Trocar modelo de `google/gemini-2.5-flash` para `google/gemini-2.5-pro` (melhor fundamentação legal)

## Resultado esperado
- Todas as chamadas de IA (exceto Whisper e busca jurisprudencial) passam pelo Lovable Cloud
- Tarefas jurídicas complexas usam modelos mais potentes para respostas de melhor qualidade
- Modelos Perplexity atualizados para versões corretas

