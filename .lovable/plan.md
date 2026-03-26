

## Corrigir dados incorretos de tarefas pendentes e ranking de colaboradores

### Problema raiz

1. **Sync sobrescreve status local**: A edge function `sync-advbox-tasks` sempre define `status: hasCompleted ? 'completed' : 'pending'` baseado no campo `users[].completed` da API do ADVBox. Porém, muitas tarefas que foram concluídas no ADVBox NÃO têm esse campo preenchido — a API simplesmente não marca `completed` nos usuários. Resultado: ~8.400 tarefas aparecem como "pending" quando muitas já foram concluídas.

2. **Sync reverte conclusões locais**: Tarefas marcadas como "completed" manualmente na intranet são revertidas para "pending" no próximo sync, pois o upsert sobrescreve o status.

3. **Contagem inflada na Distribuição**: Em `DistribuicaoTarefas.tsx` (linha 199), qualquer tarefa com status que não seja explicitamente "pending" ou "in_progress" é contada como pendente — inflando o ranking.

### Plano de correção

#### 1. Preservar status local no sync
**Arquivo:** `supabase/functions/sync-advbox-tasks/index.ts`

- Antes de upsertar, buscar do banco os `advbox_id` que já têm `status = 'completed'` (concluídos localmente)
- No mapeamento do batch, se o `advbox_id` já está como "completed" no banco E a API não traz `users[].completed`, manter o status "completed" em vez de resetar para "pending"
- Isso preserva as conclusões feitas manualmente na intranet

#### 2. Melhorar detecção de conclusão no sync
**Arquivo:** `supabase/functions/sync-advbox-tasks/index.ts`

- Além de checar `users[].completed`, verificar também se TODOS os usuários atribuídos têm `completed` preenchido (tarefa 100% concluída) vs apenas alguns
- Considerar tarefas com `due_date` muito antigo (>90 dias no passado) e sem atividade como potencialmente concluídas — marcar com status especial `'stale'` em vez de "pending"

#### 3. Corrigir contagem na Distribuição de Tarefas
**Arquivo:** `src/pages/DistribuicaoTarefas.tsx`

- Remover a linha 199 que conta tudo como "pending" por default
- Filtrar apenas tarefas que realmente tenham status `'pending'` ou `'in_progress'`
- Excluir tarefas com status `'stale'` ou `'completed'` da contagem
- Adicionar "TATIANE" à lista de exclusão de colaboradores não-operacionais (conforme memória do projeto)

#### 4. Filtrar tarefas "stale" na página de Tarefas
**Arquivo:** `src/pages/TarefasAdvbox.tsx`

- Adicionar filtro de status "Obsoletas" para tarefas marcadas como stale
- Por padrão, ocultar tarefas stale da listagem principal
- Adicionar contadores corretos no resumo (pendentes vs concluídas vs obsoletas)

### Resultado
- Tarefas concluídas manualmente na intranet não serão revertidas pelo sync
- Tarefas antigas sem atividade serão classificadas como "obsoletas" em vez de pendentes
- O ranking de distribuição por colaborador refletirá apenas tarefas verdadeiramente pendentes
- Contadores e badges ficarão corretos

