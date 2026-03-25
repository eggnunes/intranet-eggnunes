

## Correções no Resumo Diário e Filtros de Período no CRM

### Problemas identificados

1. **Publicações DJE no digest**: O matching atual usa `nome_advogado` (nome do advogado na publicação), mas deveria buscar as publicações dos **processos em que cada pessoa é responsável no Advbox**. Além disso, as publicações aparecem DEPOIS das tarefas — para o operacional, devem aparecer PRIMEIRO.

2. **Marcos recebendo conteúdo errado**: Marcos tem position `socio`, que está em `OPERATIONAL_POSITIONS`. Ele lidera o comercial, então deve receber **métricas comerciais (leads)** no digest, não tarefas operacionais.

3. **CRM Ranking e Comissões sem filtro de período**: Ambos os componentes mostram apenas o ciclo comercial atual (25 a 24). Não há como consultar períodos anteriores.

---

### Implementação

**1. Edge Function `send-daily-digest/index.ts`**

- **Matching de publicações por processo**: Em vez de comparar `nome_advogado` com o nome do usuário, buscar os `process_number` distintos da tabela `advbox_tasks` onde o usuário está em `assigned_users` (via ilike, mesmo padrão já usado para tarefas). Depois, filtrar `publicacoes_dje` onde `numero_processo` está na lista de processos do usuário.

- **Reordenar o HTML**: No `buildDigestHtml`, mover a seção de Publicações DJE para ANTES das tarefas atrasadas/pendentes para usuários operacionais.

- **Tratar `socio` como comercial**: Mover `socio` de `OPERATIONAL_POSITIONS` para uma nova lógica: sócios recebem conteúdo comercial (leads) mas NÃO recebem tarefas do Advbox (já que não são operacionais). Especificamente: `const isCommercial = COMMERCIAL_POSITIONS.some(...) || position === 'socio'` e remover `socio` de `OPERATIONAL_POSITIONS`.

**2. `CRMRanking.tsx` — Filtro de período**

- Substituir o `useMemo` fixo de `getBusinessCyclePeriod()` por um estado `selectedOffset` (0 = atual, -1 = anterior, -2 = dois atrás...)
- Adicionar função `getBusinessCyclePeriodWithOffset(offset)` que calcula o ciclo baseado no offset
- Adicionar um `Select` dropdown no header com opções: "Período Atual", "Período Anterior", "2 períodos atrás", "3 períodos atrás", "4 períodos atrás", "5 períodos atrás"
- Refetch dos dados quando o período mudar

**3. `CRMCommissions.tsx` — Filtro de período**

- Mesmo padrão: adicionar `selectedOffset` state e Select dropdown
- Função `getBusinessCyclePeriodWithOffset(offset)` (reutilizável)
- Recalcular comissões e faixa ativa ao trocar período
- Refetch dos dados quando o período mudar

---

### Arquivos modificados
- **`supabase/functions/send-daily-digest/index.ts`** — matching por processo, reordenação, tratamento do sócio
- **`src/components/crm/CRMRanking.tsx`** — filtro de período com offset
- **`src/components/crm/CRMCommissions.tsx`** — filtro de período com offset

### Resultado esperado
- Operacional recebe publicações DJE dos seus processos em primeiro lugar no e-mail
- Marcos (sócio) recebe métricas de leads do comercial no digest
- Ranking e Comissões permitem navegar entre períodos anteriores

