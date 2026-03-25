

## Correção: Poucos contratos fechados no Ranking

### Problema raiz identificado

Investigação no banco de dados revelou:

1. **O estágio "Fechamento" tem `is_won = false`** — A sincronização com RD Station define `is_won` baseado no nome do estágio, procurando "ganho" ou "won" (linha 432 do crm-sync). Mas o estágio real chama-se **"Fechamento"**, que não contém nenhuma dessas palavras. Resultado: `is_won` nunca é setado como `true`.

2. **Impacto**: Quando um deal muda para o estágio "Fechamento" durante a sincronização, o código (linhas 210-213) verifica `stage.is_won` para definir `won = true` e `closed_at`. Como `is_won` é `false`, isso nunca acontece. Os únicos deals marcados como `won` são aqueles onde o RD Station já retorna `deal.win = true` no JSON da API — que só acontece para deals explicitamente marcados como ganhos no RD Station (poucos).

3. **Dados atuais**: 264 deals em "Fechamento" com `won = true`, mas apenas 4 com `closed_at` no período atual (25/02 - 24/03). No RD Station há muito mais.

### Solução

**1. Corrigir detecção de `is_won` no sync de pipelines** (crm-sync/index.ts, linha 432)

Adicionar "fechamento" à lista de nomes que identificam estágio de vitória:
```
is_won: stage.name?.toLowerCase().includes('ganho') 
    || stage.name?.toLowerCase().includes('won') 
    || stage.name?.toLowerCase().includes('fechamento')
```

**2. Migração SQL — Corrigir estágio "Fechamento" imediatamente**

```sql
UPDATE crm_deal_stages SET is_won = true WHERE name = 'Fechamento';
```

**3. Corrigir deals existentes em "Fechamento" sem `won = true` ou sem `closed_at` recente**

Na lógica de `syncDeals`, após o upsert, adicionar verificação: se o deal está no estágio com `is_won = true` e não tem `won = true`, atualizar `won` e `closed_at`.

Também adicionar uma query pós-sync para corrigir deals que já estão em "Fechamento" mas não foram marcados como `won`:
```sql
UPDATE crm_deals 
SET won = true, 
    closed_at = COALESCE(closed_at, stage_changed_at, updated_at, NOW())
WHERE stage_id IN (SELECT id FROM crm_deal_stages WHERE is_won = true)
  AND won = false;
```

**4. Melhorar o upsert de deals** (crm-sync/index.ts, ~linha 769-787)

Na transformação dos dados do deal, além de verificar `deal.win`, também verificar se o estágio atual é um estágio de vitória:
```typescript
const stageIsWon = stageInfo && wonStageIds.has(stageInfo.id);
won: deal.win === true || deal.win === 'won' || deal.win === 1 || stageIsWon,
closed_at: deal.closed_at || (stageIsWon ? (deal.last_activity_at || deal.created_at) : null),
```

### Resultado esperado
- Os 30+ contratos fechados no período aparecerão corretamente no Ranking
- Futuros deals movidos para "Fechamento" serão automaticamente marcados como `won`
- TV Mode também será corrigido automaticamente (usa a mesma tabela)

