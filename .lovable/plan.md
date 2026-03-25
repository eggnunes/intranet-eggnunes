

## Correção: Atividades do CRM com zero concluídas e erro ao sincronizar

### Problema raiz

A sincronização está buscando dados do endpoint errado da API do RD Station:
- **Endpoint atual**: `GET /activities` — Este é o endpoint de **anotações/notas**, que não tem status de conclusão
- **Endpoint correto**: `GET /tasks` — Este é o endpoint de **tarefas**, que contém `done` (boolean), `done_date`, `subject`, `type`

Resultado: todas as 344 "atividades" têm título "Atividade" (fallback), tipo "task" e `completed = false`, porque o endpoint de anotações não retorna esses campos.

Além disso, o endpoint `/deals/{id}/activities` (por deal) também busca anotações, não tarefas. O endpoint correto para tarefas por deal é `/tasks?deal_id={id}`.

### Solução

**Arquivo: `supabase/functions/crm-sync/index.ts`** — Função `syncActivities`

1. **Substituir endpoints de anotações por tarefas**:
   - Trocar `GET /activities?token=...` por `GET /tasks?token=...&limit=200`
   - Trocar `GET /deals/{id}/activities` por `GET /tasks?deal_id={id}&token=...&limit=100`

2. **Corrigir mapeamento dos campos** conforme a API de tarefas retorna:
   - `_id` → `rd_station_id`
   - `subject` → `title`
   - `done` (boolean) → `completed`
   - `done_date` → `completed_at`
   - `date` → `due_date`
   - `type` → `type` (valores: call, email, meeting, task, lunch, visit, whatsapp)
   - `notes` → `description`
   - `deal._id` → mapeamento para deal local
   - `users[0].email` → mapeamento para owner

3. **Buscar tarefas concluídas e pendentes**: Adicionar parâmetro `done=true` numa segunda passagem para garantir que tarefas concluídas também são importadas (a API permite filtro por `done`)

4. **Paginar corretamente**: A API de tasks usa `has_more` (boolean) em vez de verificar se `items.length < limit`

**Arquivo: `src/components/crm/CRMActivities.tsx`**

5. **Adicionar contadores no topo**: Exibir badges com contagem (ex: "Todas (344)", "Pendentes (280)", "Concluídas (64)") para feedback visual imediato

### Mapeamento detalhado (RD Station Tasks → crm_activities)

```text
RD Station Tasks API          →   crm_activities
─────────────────────          ─   ──────────────
_id                            →   rd_station_id
subject                        →   title
type (call/email/meeting/...)  →   type
notes                          →   description
date                           →   due_date
done (boolean)                 →   completed
done_date                      →   completed_at
deal._id                       →   deal_id (via lookup)
users[0].email                 →   owner_id (via profile lookup)
```

### Resultado esperado
- Atividades concluídas aparecerão corretamente com a contagem real
- Títulos reais das tarefas (subject) em vez de "Atividade"
- Tipos corretos (ligação, reunião, email, etc.)
- Sincronização sem erro

