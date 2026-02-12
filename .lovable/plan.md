

## Plano: Corrigir Sincronizacao CRM com RD Station

### Diagnostico

Apos analise detalhada do codigo, logs e banco de dados, identifiquei a causa raiz principal:

---

### Problema Principal: Funcao de sincronizacao da timeout e nunca atualiza o timestamp

**O que acontece**: Quando voce clica "Sincronizar RD Station", a funcao executa 4 etapas em sequencia:
1. Sync Pipelines (rapido)
2. Sync Contatos (rapido - upsert em lote)
3. Sync Deals/Oportunidades (rapido - upsert em lote)
4. Sync Atividades (LENTO - itera 1.742 deals um por um)

A etapa 4 faz uma chamada HTTP individual para CADA um dos 1.742 deals para buscar atividades. Os logs mostram que ela processa ~50 deals a cada 8 segundos, entao levaria ~280 segundos (4.5 minutos). A funcao tem timeout de ~150 segundos e e encerrada (log: "shutdown") antes de completar.

**O codigo que atualiza `last_full_sync_at` esta APOS a etapa 4** (linha 53-56). Como a funcao e encerrada antes, esse codigo nunca executa. Por isso a interface mostra "Ultima sync: 11/12, 02:09" mesmo com sincronizacoes recentes.

**Comprovacao**: Os logs mostram "Processed 750/1742 deals" seguido de "shutdown". E o banco confirma que `last_full_sync_at` esta em `2025-12-11 05:09:14`.

---

### Problema Secundario: Contagem de contratos desatualizada

Os dados no banco ESTAO sendo sincronizados (pipelines, contatos e deals funcionam). O banco atualmente mostra:
- Daniel: 18 contratos fechados (periodo 25/01 a 24/02)
- Jhonny: 4 contratos fechados
- Lucas: 2 contratos fechados
- Total: 24

O screenshot mostra 21 (17+2+2) porque foi capturado antes da ultima sincronizacao em 12/02. Mas o usuario relata que mesmo esses numeros ainda estao abaixo do real no RD Station, o que indica que pode haver deals no RD Station com dados que nao estao sendo mapeados corretamente (ex: campo `win` nulo ao inves de true).

---

### Correcoes Propostas

**Arquivo: `supabase/functions/crm-sync/index.ts`**

1. **Mover a atualizacao de `last_full_sync_at` para ANTES da sync de atividades**:
   - Atualizar o timestamp logo apos o sync de deals (etapa 3) ter concluido com sucesso
   - Assim, mesmo que a sync de atividades de timeout, o timestamp e salvo corretamente
   - Simplificar a query de update (remover o nested await fragil)

2. **Otimizar o sync de atividades para nao dar timeout**:
   - Ao inves de iterar TODOS os 1.742 deals, limitar a busca de atividades apenas a deals recentes (criados ou atualizados nos ultimos 90 dias)
   - Isso reduz de ~1.742 chamadas para ~200-300, completando em tempo habil
   - Adicionar um delay entre chamadas para evitar rate limiting

3. **Melhorar o mapeamento do campo `won`**:
   - Atualmente: `won: deal.win` - o campo `win` do RD Station pode ser `null`, `"won"`, `true`, etc.
   - Adicionar tratamento explicito: `won: deal.win === true || deal.win === "won"`
   - Tambem verificar se deals com `deal_stage` de tipo "ganho" (won) devem ter `won = true` mesmo que o campo `win` nao esteja preenchido

---

### Alteracoes Tecnicas Detalhadas

**Bloco `full_sync` (linhas 46-64)**:
```
// ANTES: update apos activities (nunca executa)
pipelines -> contacts -> deals -> activities -> UPDATE last_full_sync_at

// DEPOIS: update apos deals (sempre executa)
pipelines -> contacts -> deals -> UPDATE last_full_sync_at -> activities (otimizado)
```

Simplificar o update de:
```typescript
.eq('id', (await supabase.from('crm_settings').select('id').single()).data?.id)
```
Para:
```typescript
.eq('id', settingsId) // buscar ID uma unica vez no inicio
```

**Funcao `syncActivities` (linhas 812-892)**:
- Filtrar deals para buscar atividades apenas dos ultimos 90 dias
- Adicionar delay de 200ms entre chamadas para evitar rate limiting

**Funcao `syncDeals` - mapeamento won (linha 772)**:
```typescript
// ANTES:
won: deal.win

// DEPOIS:
won: deal.win === true || deal.win === 'won' || deal.win === 1
```

---

### Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Timestamp ultima sync | Parado em 11/12/2025 | Atualizado a cada sync |
| Timeout na sync | Funcao encerrada apos ~150s | Completa dentro do tempo |
| Atividades sincronizadas | 0 (timeout antes) | Atividades dos ultimos 90 dias |
| Mapeamento won | Pode ignorar deals ganhos | Reconhece multiplos formatos |
| Contratos fechados | Possivel subcontagem | Contagem precisa |

