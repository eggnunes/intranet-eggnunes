

## Atualizar modelo Claude descontinuado

### Resultado da verificação
Verifiquei **todas as 9 Edge Functions** que utilizam a API da Anthropic. Apenas **1 arquivo** ainda usa o modelo descontinuado:

| Arquivo | Modelo atual | Status |
|---|---|---|
| `translate-movement/index.ts` | `claude-3-5-sonnet-20241022` | Descontinuado |
| `meta-ads-ai-analysis/index.ts` | `claude-sonnet-4-20250514` | OK |
| `check-portuguese/index.ts` | `claude-sonnet-4-20250514` | OK |
| `suggest-task/index.ts` | `claude-sonnet-4-20250514` | OK |
| `ai-assistant/index.ts` | `claude-sonnet-4-20250514` | OK |
| `chat-with-agent/index.ts` | `claude-sonnet-4-20250514` | OK |
| `analyze-viability/index.ts` | `claude-sonnet-4-20250514` | OK |
| `suggest-petition/index.ts` | `claude-sonnet-4-20250514` | OK |
| `suggest-agent-instructions/index.ts` | `claude-sonnet-4-20250514` | OK |

### Correção

**Arquivo:** `supabase/functions/translate-movement/index.ts` (linha 68)

Trocar `claude-3-5-sonnet-20241022` por `claude-sonnet-4-20250514`.

### Resultado
Todas as funções passarão a usar o modelo Claude Sonnet 4 atualizado.

