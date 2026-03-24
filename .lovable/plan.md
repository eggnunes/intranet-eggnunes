

## Redução do consumo de Cloud — Limpeza e otimização de auditoria

### O que será feito

1. **Limpeza imediata** — Deletar registros de `audit_log` e `fin_auditoria` com mais de 90 dias
2. **Cron job semanal** — Agendar limpeza automática via pg_cron + edge function
3. **Otimizar triggers** — Alterar `audit_trigger_fn` e `fin_audit_trigger` para salvar apenas campos alterados (diff) em vez do JSON completo
4. **Reduzir auditoria CRM** — Remover triggers de auditoria das tabelas `crm_contacts` e `crm_deals` (geram ~170k registros desnecessários)

### Implementação

**1. Edge function `cleanup-audit-logs/index.ts`**
- Deleta registros de `audit_log` onde `created_at < NOW() - INTERVAL '90 days'`
- Deleta registros de `fin_auditoria` onde `created_at < NOW() - INTERVAL '90 days'`
- Retorna contagem de registros removidos

**2. Cron job semanal (SQL via insert tool)**
- Habilitar extensões `pg_cron` e `pg_net` (migração)
- Agendar chamada semanal (domingo 3h) à edge function de limpeza

**3. Migração — Otimizar `audit_trigger_fn`**
- No caso de UPDATE, calcular diff: salvar em `dados_anteriores` apenas os campos que mudaram (valor antigo) e em `dados_novos` apenas os campos que mudaram (valor novo)
- Ignorar campos de timestamp (`updated_at`, `created_at`) no diff para evitar registros inúteis
- Manter comportamento atual para INSERT e DELETE

**4. Migração — Otimizar `fin_audit_trigger`**
- Mesma lógica de diff para UPDATE
- Salvar apenas campos alterados

**5. Migração — Remover triggers de auditoria do CRM**
- `DROP TRIGGER IF EXISTS audit_crm_contacts ON crm_contacts`
- `DROP TRIGGER IF EXISTS audit_crm_deals ON crm_deals`

**6. Limpeza inicial (via insert tool)**
- `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
- `DELETE FROM fin_auditoria WHERE created_at < NOW() - INTERVAL '90 days'`

### Resultado esperado
- Liberação imediata de ~400MB+ de espaço
- Crescimento futuro drasticamente reduzido (diff em vez de JSON completo)
- Limpeza automática semanal mantendo apenas 90 dias de histórico

