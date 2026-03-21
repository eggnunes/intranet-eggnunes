

## Fix: Tempo Médio por Etapa mostrando 26 dias para todas as etapas

### Causa raiz

Dois problemas combinados:

1. **`crm_deal_history` está vazia** — a sincronização com RD Station nunca registra transições de estágio, então não há histórico de movimentação
2. **`updated_at` é sobrescrito pela sync** — toda vez que o cron roda, TODOS os deals recebem o mesmo `updated_at` (o timestamp da sync). O código usa `updated_at` para calcular tempo no estágio, resultando em ~26 dias para todos

### Solução

**1. Registrar transições de estágio na sync** (`supabase/functions/crm-sync/index.ts`)
- Na função `syncDeals`, ao fazer upsert de um deal, comparar o `stage_id` atual (do banco) com o novo (do RD Station)
- Se mudou, inserir registro em `crm_deal_history` com `from_stage_id`, `to_stage_id` e timestamp
- Para deals novos (INSERT), registrar entrada no primeiro estágio

**2. Adicionar coluna `stage_changed_at` à tabela `crm_deals`** (migration)
- Novo campo que só é atualizado quando o estágio realmente muda (não pela sync periódica)
- A sync atualiza esse campo apenas quando detecta mudança de estágio

**3. Corrigir cálculo no `CRMAnalytics.tsx`**
- Usar `crm_deal_history` como fonte primária (transições registradas)
- Para deals sem histórico, usar `stage_changed_at` (se existir) ou `created_at` como fallback em vez de `updated_at`
- Isso elimina a distorção causada pela sync

### Arquivos alterados
- `supabase/functions/crm-sync/index.ts` — detectar mudanças de estágio e registrar em `crm_deal_history`
- `src/components/crm/CRMAnalytics.tsx` — usar `stage_changed_at` / `created_at` como fallback
- Nova migration — adicionar coluna `stage_changed_at` em `crm_deals`

