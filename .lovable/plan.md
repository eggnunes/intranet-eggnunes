

## Correção: Alertas "Deal Parado" mostrando sempre 26 ou 7 dias

### Problema raiz

Na linha 114 de `CRMNotifications.tsx`, o cálculo de dias parado usa `deal.updated_at`:
```typescript
const lastUpdate = new Date(deal.updated_at);
```

O campo `updated_at` é sobrescrito pela sincronização automática com RD Station (a cada 3 horas). Todos os deals recebem o mesmo `updated_at` no momento do sync, resultando em todos mostrando exatamente o mesmo numero de dias (26 ou 7, dependendo de quando o alerta foi gerado).

### Solução

**Arquivo: `src/components/crm/CRMNotifications.tsx`** — Linha 114

Trocar `updated_at` por `stage_changed_at`, que reflete a data real da última movimentação do deal:

```typescript
// Antes:
const lastUpdate = new Date(deal.updated_at);

// Depois:
const lastUpdate = new Date(deal.stage_changed_at || deal.created_at);
```

Isso faz com que cada deal mostre corretamente quantos dias está sem movimentação real de estágio, em vez de usar o timestamp do último sync.

### Limpeza complementar

Deletar as notificações antigas geradas com valores incorretos para que sejam recriadas com os valores corretos:

- Executar via migração: `DELETE FROM crm_notifications WHERE type = 'stale_deal';`

Ao reabrir a aba de Alertas, as notificações serão regeneradas automaticamente com os dias corretos (função `generateAlerts` roda no `useEffect`).

