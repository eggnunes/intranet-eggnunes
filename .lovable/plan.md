

# Integração da API da Anthropic (Claude) na Intranet

## Resumo
Adicionar os modelos Claude da Anthropic como opção no assistente de IA e usar Claude em edge functions onde ele se destaca: análise jurídica profunda (viabilidade, petições) e correção de textos longos.

## Passo 1: Adicionar o secret da API key
Solicitar que você forneça a chave `ANTHROPIC_API_KEY` via ferramenta de secrets.

## Passo 2: Atualizar `supabase/functions/ai-assistant/index.ts`
- Adicionar modelos Claude ao `MODEL_MAP`: `claude-sonnet` → `claude-sonnet-4-20250514`, `claude-haiku` → `claude-haiku-4-20250414`
- Criar função `callClaude()` que chama `https://api.anthropic.com/v1/messages` com header `x-api-key` e `anthropic-version: 2023-06-01`
- Suporte a streaming (SSE) e não-streaming
- Adicionar `isClaudeModel()` check na lógica principal

## Passo 3: Atualizar modelos no frontend `src/pages/AssistenteIA.tsx`
- Adicionar Claude Sonnet 4 e Claude Haiku 4 à lista `AI_MODELS` com badges e descrições

## Passo 4: Usar Claude em tarefas jurídicas complexas
Com base nas forças do Claude (análise textual profunda, instruções complexas, raciocínio jurídico):

- **`analyze-viability`**: Usar Claude Sonnet como modelo principal (melhor em seguir instruções estruturadas de parecer jurídico)
- **`suggest-petition`**: Usar Claude Sonnet (excelente em fundamentação legal detalhada)
- **`check-portuguese`**: Usar Claude Sonnet (superior em análise gramatical e estilística do português)

Manter o Lovable Gateway (Gemini/GPT) para tarefas rápidas e simples. Manter Perplexity para busca web. Manter OpenAI para transcrição de áudio (Whisper).

## Passo 5: Usar OpenAI direto via `OPENAI_API_KEY` existente
Para os modelos OpenAI no assistente que têm badge "API Key" (gpt-4o, o3, o4-mini), usar a chave OpenAI direta em vez do gateway, já que você já forneceu essa chave — garantindo acesso direto sem consumir créditos do Lovable.

## Arquivos alterados
1. `supabase/functions/ai-assistant/index.ts` — adicionar Claude + OpenAI direto
2. `src/pages/AssistenteIA.tsx` — adicionar modelos Claude na lista
3. `supabase/functions/analyze-viability/index.ts` — trocar para Claude Sonnet
4. `supabase/functions/suggest-petition/index.ts` — trocar para Claude Sonnet
5. `supabase/functions/check-portuguese/index.ts` — trocar para Claude Sonnet

