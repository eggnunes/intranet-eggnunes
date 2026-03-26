

## Corrigir erro na Tradução de Andamentos — Modelo Anthropic obsoleto

### Problema
A edge function `translate-movement` usa o modelo `claude-3-5-sonnet-20241022` que foi descontinuado pela Anthropic (retorna 404). O erro aparece como "Failed to send a request to the Edge Function" no frontend porque o status 500 é tratado genericamente.

### Correção

**Arquivo:** `supabase/functions/translate-movement/index.ts` (linha 68)

Trocar:
```typescript
model: 'claude-3-5-sonnet-20241022',
```
Por:
```typescript
model: 'claude-sonnet-4-20250514',
```

Este é o mesmo modelo já utilizado na função `suggest-task`.

### Resultado
A sugestão de tradução com IA voltará a funcionar normalmente.

