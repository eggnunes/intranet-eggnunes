

## Correção: Header `x-region` bloqueado pelo CORS

### Problema raiz
Quando se usa `region: FunctionRegion.SaEast1`, o SDK do Supabase adiciona o header `x-region` na requisição. O navegador faz um preflight OPTIONS verificando se esse header é permitido. A edge function `pje-publicacoes` lista apenas estes headers no CORS:

```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, ...
```

O header `x-region` **nao esta na lista**, entao o preflight falha e o `fetch` lanca o erro "Failed to send a request to the Edge Function".

### Solucao
Adicionar `x-region` a lista de `Access-Control-Allow-Headers` no `corsHeaders` da edge function `pje-publicacoes/index.ts`.

### Mudanca tecnica

**Arquivo: `supabase/functions/pje-publicacoes/index.ts` (linha 5)**

De:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

Para:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

Uma unica linha alterada. Isso permite que o navegador envie o header `x-region: sa-east-1`, o preflight passa, e a requisicao chega a funcao, que roda em Sao Paulo.

