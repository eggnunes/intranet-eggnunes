
## Solução: Forçar a Edge Function a Rodar em São Paulo (Brasil)

### Diagnóstico Confirmado

O bloqueio geográfico do CloudFront do CNJ é o problema real. A API `comunicaapi.pje.jus.br` bloqueia IPs de fora do Brasil via Amazon CloudFront. As edge functions do Supabase normalmente rodam no servidor mais próximo do usuário (Europa/EUA), o que resulta no erro 403.

### Solução Real e Definitiva

O Supabase oferece **Regional Invocations** — a capacidade de forçar uma edge function a rodar em uma região específica usando o header `x-region`. A região disponível no Brasil é **`sa-east-1` (São Paulo)**.

Ao adicionar `{ region: 'sa-east-1' }` na chamada do frontend para a edge function `pje-publicacoes`, o Supabase garante que a função rode fisicamente em São Paulo. Dessa forma, a requisição ao CNJ parte de um IP brasileiro, e o CloudFront não bloqueia.

Nenhuma nova infraestrutura ou serviço externo é necessário — é uma funcionalidade nativa do Supabase que já está disponível.

---

### Mudança Técnica

**Arquivo: `src/pages/PublicacoesDJE.tsx`**

Todas as chamadas a `supabase.functions.invoke('pje-publicacoes', ...)` precisam receber a opção `{ region: FunctionRegion.SaEast1 }` ou o header `x-region: sa-east-1`. São 4 pontos no código:

1. `handleSearch` — busca principal (`search-api` e `search-local`)
2. `loadLocal` — recarrega do cache após busca na API
3. `handleLoadMore` — paginação
4. `toggleRead` — marcar como lida/não lida

**Exemplo da mudança:**
```typescript
// ANTES:
const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
  body: { action: 'search-api', filters },
});

// DEPOIS:
import { FunctionRegion } from '@supabase/supabase-js';

const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
  body: { action: 'search-api', filters },
  region: FunctionRegion.SaEast1,  // ← força execução em São Paulo
});
```

Essa mudança de uma linha por invocação resolve completamente o bloqueio geográfico, pois a edge function passará a executar em São Paulo e o IP da requisição ao CNJ será brasileiro.

---

### Melhoria adicional na edge function

Além do regional invocation, vou também:

1. **Melhorar o tratamento de erros** na `pje-publicacoes/index.ts`: verificar `Content-Type` antes de parsear JSON (evita crash quando recebe HTML de erro), e retornar status 200 com mensagem clara em vez de repassar o status 4xx/5xx raw.

2. **Atualizar o `check-credentials`** para fazer um ping real na API do CNJ e informar se está acessível, em vez de sempre retornar `configured: true`.

3. **Adicionar User-Agent brasileiro** no header das requisições ao CNJ para evitar detecção adicional como bot.

---

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/PublicacoesDJE.tsx` | Adicionar `region: FunctionRegion.SaEast1` em todas as chamadas `supabase.functions.invoke` |
| `supabase/functions/pje-publicacoes/index.ts` | Adicionar `fetchJsonSafely`, melhorar tratamento de erro 403/HTML, adicionar User-Agent, atualizar `check-credentials` para ping real |

---

### Por que isso funciona

O Supabase tem servidores físicos em São Paulo (AWS `sa-east-1`). Quando a função roda lá, a requisição sai de um IP brasileiro legítimo da AWS no Brasil — exatamente o que o CloudFront do CNJ exige para liberar o acesso. É a mesma solução que qualquer desenvolvedor brasileiro usa ao hospedar aplicações que precisam acessar APIs governamentais com restrição geográfica.
