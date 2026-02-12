

## Plano: Corrigir Timeout na Sincronizacao CRM

### Diagnostico

O problema esta na etapa de sincronizacao de atividades. A correcao anterior pretendia filtrar apenas deals dos ultimos 90 dias, mas NAO funciona porque:

1. O upsert de deals atualiza o campo `updated_at` de TODOS os 1.742 deals para a data atual
2. O filtro `.or(created_at.gte.${cutoffDate}, updated_at.gte.${cutoffDate})` retorna TODOS os 1.742 deals (pois todos tem `updated_at` = agora)
3. Com 200ms de delay entre cada deal, sao ~350 segundos (quase 6 minutos) -- muito alem do timeout da funcao
4. A funcao e encerrada ("shutdown") apos ~150 segundos e o frontend recebe erro de rede, mostrando "Falha na sincronizacao"

A boa noticia: o timestamp `last_full_sync_at` JA esta sendo atualizado corretamente (a correcao anterior funcionou nessa parte). Os deals e contatos tambem estao sincronizados. O problema e apenas a etapa de atividades que causa o timeout.

---

### Correcao

**Arquivo: `supabase/functions/crm-sync/index.ts`**

Trocar o filtro de `updated_at` (que nao funciona) por um filtro baseado no `closed_at` (data de fechamento do deal no RD Station) e `created_at` (data original do RD Station, que e preservada no upsert):

```
// ANTES (nao funciona - updated_at e sempre "agora"):
.or(`created_at.gte.${cutoffDate},updated_at.gte.${cutoffDate}`)

// DEPOIS (funciona - usa datas originais do RD Station):
.or(`created_at.gte.${cutoffDate},closed_at.gte.${cutoffDate}`)
.not('closed_at', 'is', null) // Priorizar deals fechados recentemente
```

Porem, como isso ainda pode retornar muitos deals, adicionar um **limite maximo de 200 deals** para garantir que a funcao termine dentro do tempo:

```typescript
const MAX_DEALS_FOR_ACTIVITIES = 200;
const recentDeals = allDeals.slice(0, MAX_DEALS_FOR_ACTIVITIES);
```

Alem disso, reduzir o delay de 200ms para 100ms (suficiente para evitar rate limiting sem desperdicar tempo).

Com 200 deals e 100ms de delay, a etapa de atividades levara no maximo ~40 segundos, bem dentro do limite.

---

### Alteracoes Tecnicas

**Funcao `syncActivities` (linhas 822-906)**:

1. Trocar o filtro:
   - De: `.or(\`created_at.gte.${cutoffDate},updated_at.gte.${cutoffDate}\`)`
   - Para: `.or(\`created_at.gte.${cutoffDate},closed_at.gte.${cutoffDate}\`)`

2. Limitar a quantidade de deals processados:
   - Adicionar `const MAX_DEALS = 200;`
   - Usar `.limit(MAX_DEALS)` na query
   - Ordenar por `created_at desc` para priorizar os mais recentes

3. Reduzir delay de 200ms para 100ms

---

### Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Deals para buscar atividades | 1.742 (todos) | Maximo 200 (recentes) |
| Tempo da etapa de atividades | ~350s (timeout) | ~40s (dentro do limite) |
| Erro "Falha na sincronizacao" | Aparece sempre | Nao aparece mais |
| Timestamp ultima sync | Ja atualizado | Continua funcionando |

