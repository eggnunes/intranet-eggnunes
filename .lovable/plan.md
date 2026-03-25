

## Correção: Ranking puxando poucos contratos — `closed_at` incorreto

### Problema raiz

O campo `closed_at` na tabela `crm_deals` está com datas erradas para a maioria dos deals em "Fechamento":

- **173 de 265 deals** têm `closed_at` praticamente igual a `created_at` (diferença < 24h)
- Isso ocorre porque a API do RD Station retorna `closed_at` como `null` para muitos deals, e o fallback no código usa `deal.created_at` (data de criação do deal, não de fechamento)
- O upsert sobrescreve `closed_at` a cada sincronização com o mesmo valor errado
- A detecção de mudança de estágio (quando deal entra em Fechamento) atualiza `stage_changed_at` mas NÃO atualiza `closed_at`

### Solução (3 partes)

**1. Edge function `crm-sync/index.ts` — Corrigir fallback do `closed_at`** (linha 787)

Remover `deal.created_at` do fallback. Usar apenas `deal.closed_at` da API ou `deal.last_activity_at`. Se ambos forem null, não definir `closed_at` no upsert para deals novos:

```typescript
// Antes:
closed_at: deal.closed_at || (dealIsWon ? (deal.last_activity_at || deal.created_at || new Date().toISOString()) : null),

// Depois:
closed_at: deal.closed_at || (dealIsWon ? (deal.last_activity_at || null) : null),
```

**2. Edge function `crm-sync/index.ts` — Setar `closed_at` na detecção de mudança de estágio** (linhas 858-863)

Quando um deal muda para um estágio won, setar `closed_at = NOW()` junto com `stage_changed_at`:

```typescript
for (const upd of stageChangedUpdates) {
  const updateData: any = { stage_changed_at: new Date().toISOString() };
  if (wonStageIds.has(upd.stage_id)) {
    updateData.closed_at = new Date().toISOString();
    updateData.won = true;
  }
  await supabase.from('crm_deals').update(updateData).eq('id', upd.id);
}
```

**3. Edge function `crm-sync/index.ts` — Proteger `closed_at` de deals existentes no upsert**

Após o batch upsert, restaurar `closed_at` para deals em estágio won que já tinham um `closed_at` válido (diferente de `created_at`). Adicionar lógica pós-upsert:

```typescript
// After upsert, fix deals in won stages where closed_at was reset to null or created_at
if (wonStageIds.size > 0) {
  const wonStageIdsArr = Array.from(wonStageIds);
  
  // For won deals with null closed_at, set to stage_changed_at or updated_at
  const { data: nullClosedDeals } = await supabase
    .from('crm_deals')
    .select('id, stage_changed_at, updated_at')
    .in('stage_id', wonStageIdsArr)
    .eq('won', true)
    .is('closed_at', null);
  
  if (nullClosedDeals?.length) {
    for (const d of nullClosedDeals) {
      await supabase.from('crm_deals').update({
        closed_at: d.stage_changed_at || d.updated_at || new Date().toISOString()
      }).eq('id', d.id);
    }
  }
}
```

**4. Migração SQL — Corrigir dados existentes**

Para os 173 deals com `closed_at ≈ created_at`, recalcular usando `updated_at` como melhor aproximação disponível:

```sql
UPDATE crm_deals 
SET closed_at = updated_at
WHERE stage_id = '17de73d7-822d-4e9e-a7af-590e441b74aa'
  AND won = true
  AND abs(extract(epoch from closed_at - created_at)) < 86400
  AND closed_at < '2026-02-25';
```

Isso vai redistribuir os 173 deals para a data do último sync em que foram atualizados. Não é perfeito, mas é melhor do que ter `closed_at = created_at`.

**Porém**: como `updated_at` é sempre a data do último sync (todos iguais), isso colocaria TODOS os 173 deals no período atual — gerando 170+ contratos em vez de 30.

**Abordagem melhor para a migração**: Forçar re-sync com logging dos campos retornados pela API, especificamente `deal.closed_at` e `deal.last_activity_at`, para entender exatamente o que o RD Station retorna. Se `last_activity_at` for consistente, usá-lo como base.

**5. Adicionar logging de debug temporário na sync**

Adicionar `console.log` para os primeiros 5 deals em Fechamento, logando todos os campos de data da API (`closed_at`, `last_activity_at`, `created_at`, `updated_at`, `win`, `win_date`). Isso nos dará visibilidade sobre quais campos a API realmente retorna para calibrar a lógica.

### Resultado esperado
- Novos deals movidos para Fechamento terão `closed_at = NOW()` correto
- O fallback não mais usará `created_at` (que dá datas erradas)
- Com o debug logging, poderemos calibrar a migração dos dados existentes na próxima iteração

