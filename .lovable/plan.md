
## Plano: Análise e Correção Geral do Sistema Financeiro

### Diagnóstico Completo

Após uma análise profunda do banco de dados e do código, identifiquei **3 problemas críticos** que estão fazendo o financeiro não espelhar a realidade:

---

### Problema 1: Sincronização Financeira Parada desde 3 de Fevereiro

**O que acontece**: A sincronização com o ADVBox completou em 03/02/2026 e **nunca mais rodou**. Fevereiro tem apenas 21 registros (3 dias), enquanto Janeiro tem 407. Todas as transações de boleto, cartão e Asaas que entraram no ADVBox após dia 3 não foram importadas.

**Causa raiz**: O cron job automático (a cada 2 minutos) tem uma condição `WHERE status = 'running'`. Como a sincronização terminou com status `completed`, o cron nunca mais dispara. E quando a Edge Function recebe uma chamada com status `completed`, ela retorna imediatamente sem fazer nada.

**Impacto**: R$ 1.014,25 de receita exibida vs. o valor real que deveria ser muito maior.

**Correção no `supabase/functions/sync-advbox-financial/index.ts`**:
- Quando o status for `completed`, ao invés de retornar sem fazer nada, **iniciar automaticamente uma sincronização incremental** dos últimos 60 dias
- Resetar offset para 0 e atualizar `start_date` e `end_date` para o período recente
- Isso permite que o cron continue buscando novas transações continuamente

**Correção no pg_cron**: Alterar a condição do cron job para disparar quando status for `running` **OU** `completed` (já que agora o completed reinicia a sync incremental).

---

### Problema 2: Registros Existentes Nunca São Atualizados

**O que acontece**: Quando o ADVBox marca um boleto como "pago" (ex: via integração Asaas), a sincronização local **ignora** esse registro porque ele já existe (`skipped`). Resultado: 12 receitas de fevereiro estão como "pendente" no sistema mesmo que já tenham sido pagas no ADVBox.

**Impacto**: O dashboard filtra por `status = 'pago'`, então receitas pagas mas com status desatualizado não aparecem.

**Correção no `supabase/functions/sync-advbox-financial/index.ts`**:
- No `processTransactionsBatch`, quando um registro já existe, **comparar e atualizar** os campos `status`, `data_pagamento` e `valor` se houve mudança no ADVBox
- Isso garante que boletos pagos via Asaas tenham o status atualizado automaticamente

---

### Problema 3: Dashboard Usa `data_lancamento` em Vez de `data_vencimento`

**O que acontece**: O dashboard executivo filtra por `data_lancamento`, mas muitos lançamentos vindos do ADVBox têm `data_lancamento` diferente de `data_vencimento`. Pagamentos de despesas feitos em fevereiro com vencimento em janeiro aparecem no mês errado, distorcendo os valores (ex: R$ 18.737 de despesas "pagas" aparecendo em fevereiro por causa da data de lançamento).

**Correção no `src/components/financeiro/FinanceiroExecutivoDashboard.tsx`**:
- Usar `data_vencimento` como campo principal de filtro para o período (regime de competência)
- Alternativamente, oferecer opção regime de caixa (`data_pagamento`) vs. competência (`data_vencimento`)

---

### Alterações Técnicas Detalhadas

**Arquivo 1: `supabase/functions/sync-advbox-financial/index.ts`**

1. **Bloco `status === 'completed'` (linhas 649-660)**: Em vez de retornar "já concluída", resetar para uma sincronização incremental dos últimos 60 dias:
   - Calcular novo `start_date` = hoje - 60 dias
   - Atualizar `end_date` = hoje
   - Resetar `last_offset` = 0
   - Mudar status para `running`
   - Continuar o fluxo normal

2. **Bloco de processamento existente (linhas 368-382 em `processTransactionsBatch`)**: Quando o registro já existe, verificar se houve mudança:
   - Se `date_payment` do ADVBox é diferente de `data_pagamento` local, atualizar
   - Se o status mudou (ex: agora está pago), atualizar `status` e `data_pagamento`
   - Incrementar `updated` ao invés de `skipped`

**Arquivo 2: Migração SQL (pg_cron)**

- Remover a condição `WHERE EXISTS (... status = 'running')` do cron job
- O cron agora sempre dispara a cada 2 minutos, e a Edge Function decide internamente o que fazer

**Arquivo 3: `src/components/financeiro/FinanceiroExecutivoDashboard.tsx`**

- Trocar todas as queries de `data_lancamento` para `data_vencimento` (linhas 162-186, 291-296)
- Isso alinha o dashboard ao regime de competência, que é o padrão contábil

---

### Resumo do Impacto Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Sincronização | Parada desde 03/02 | Incremental contínua a cada 2 min |
| Registros Fev/26 | 21 registros | Todos os registros do ADVBox |
| Status de pagamento | Nunca atualizado | Atualizado automaticamente |
| Receitas Fev/26 | R$ 1.014,25 | Valor real do ADVBox |
| Base de período | data_lancamento (inconsistente) | data_vencimento (competência) |

---

### Ordem de Execução

1. Atualizar a Edge Function `sync-advbox-financial` (sync incremental + atualização de registros)
2. Fazer deploy da Edge Function
3. Atualizar o pg_cron para remover condição restritiva
4. Corrigir queries do Dashboard Executivo para usar `data_vencimento`
5. Disparar uma sincronização manual para importar os dados faltantes de fevereiro
