

## Corrigir Busca de Clientes ADVBox nas Decisões Favoráveis

### Problemas Identificados

1. **Fonte de dados lenta/instável**: O código busca clientes via edge function `advbox-integration/customers` (API externa), que é lenta e pode falhar. Existe uma tabela local `advbox_customers` sincronizada a cada 15 minutos que não está sendo usada.

2. **Busca sem normalização de acentos**: O filtro usa `.toLowerCase().includes()` que não remove acentos. Digitar "emilio" não encontra "Emílio".

### Solução

**Arquivo: `src/pages/DecisoesFavoraveis.tsx`**

1. **Trocar fonte de dados**: Substituir a chamada à edge function por uma query direta à tabela `advbox_customers` do banco local. Isso garante carregamento instantâneo e confiável.

2. **Adicionar normalização de acentos**: Criar função `normalize` que remove acentos (`NFD` + regex) e converte para minúsculas. Usar na comparação do `filteredClients`.

3. **Manter botão de refresh**: O botão de busca manual passará a invocar `sync-advbox-customers` para forçar sincronização e depois recarregar da tabela local.

### Mudanças específicas

- Query `advbox-customers`: trocar `supabase.functions.invoke('advbox-integration/customers')` por `supabase.from('advbox_customers').select('advbox_id, name').order('name')`. Mapear `advbox_id` para `id`.

- Filtro `filteredClients` (linha 501-505): normalizar com remoção de acentos:
  ```typescript
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filteredClients = clientSearch.length >= 2
    ? advboxClients.filter((c) => normalize(c.name).includes(normalize(clientSearch))).slice(0, 15)
    : [];
  ```

- `handleSearchClients`: invocar `sync-advbox-customers` para forçar sincronização, depois `refetchClients()`.

