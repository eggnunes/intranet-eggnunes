

## Corrigir nomes "Sem contato" na aba de Comissões

### Problema
Na aba de Comissões (`CRMCommissions.tsx`), o nome do cliente é buscado **apenas** pelo `contact_id` na tabela `crm_contacts`. Quando o deal não tem contato vinculado, aparece "Sem contato". No Ranking (`CRMRanking.tsx`), esse problema já foi corrigido usando o `deal.name` como fallback — mas a correção não foi replicada nas Comissões.

### Correção

**Arquivo:** `src/components/crm/CRMCommissions.tsx` (linha 134)

Aplicar o mesmo fallback já usado no Ranking:

```typescript
// Antes:
contactName: deal.contact_id ? (contactMap.get(deal.contact_id) || null) : null,

// Depois:
contactName: (deal.contact_id ? contactMap.get(deal.contact_id) : null) || deal.name || null,
```

### Resultado
Os nomes dos clientes nas Comissões passarão a exibir o nome da oportunidade (deal) do RD Station quando o contato não está vinculado, ficando consistente com o Ranking.

