

## Problema Identificado

A função `fetchClientLawsuits` (linha 270-296 do `DecisoesFavoraveis.tsx`) tem dois problemas:

### 1. Acesso incorreto à estrutura de dados da resposta
A resposta do endpoint `lawsuits-full` retorna `{ data: items[] }`, mas o código acessa `response.data?.data?.items || response.data?.data`, que resulta em caminho errado. `supabase.functions.invoke` retorna `{ data, error }` onde `data` já é o body da resposta, então os lawsuits estão em `response.data?.data` (o array direto), mas o filtro subsequente falha.

### 2. Filtro client-side por `customer_id` não funciona
O código na linha 281-283 filtra por `l.customer_id?.toString() === clientId` ou `l.customers?.some(...)`. Os objetos de processo do Advbox provavelmente não possuem `customer_id` como campo direto — a associação cliente-processo na API Advbox usa outra estrutura de dados (campo `client` ou array `clients`).

## Solução

Em vez de buscar TODOS os processos via API e filtrar client-side (ineficiente e propenso a erro), criar um **novo endpoint no edge function** que busca processos diretamente pelo `customer_id` usando a API do Advbox (`/lawsuits?customer_id=X`), ou alternativamente usar o endpoint existente `/lawsuits/{id}` por customer.

A abordagem mais confiável é adicionar um novo case `lawsuits-by-customer` no edge function que faz a query filtrada na API do Advbox, e atualizar o `fetchClientLawsuits` no frontend para usar esse novo endpoint.

### Mudanças:

**1. `supabase/functions/advbox-integration/index.ts`** — Adicionar case `lawsuits-by-customer`:
- Receber `customer_id` como query param
- Chamar `/lawsuits?customer_id={id}&limit=100` na API do Advbox
- Retornar os processos filtrados diretamente

**2. `src/pages/DecisoesFavoraveis.tsx`** — Atualizar `fetchClientLawsuits`:
- Chamar o novo endpoint `advbox-integration/lawsuits-by-customer?customer_id=X`
- Corrigir o mapeamento de campos (`number`, `court`, `court_division`) para usar os nomes corretos da API
- Se o resultado tiver apenas 1 processo, auto-selecionar preenchendo o número do processo automaticamente

