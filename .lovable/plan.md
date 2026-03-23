

# Cache Persistente do Dashboard Financeiro

## Problema
O Dashboard Financeiro Executivo (`FinanceiroExecutivoDashboard.tsx`) abre zerado e faz ~10 queries sequenciais ao banco + chamada à API do Asaas antes de mostrar dados. Isso causa delay perceptível e tela vazia durante o carregamento.

## Solução
Mesma abordagem aplicada ao Dashboard de Processos: tabela de cache no banco, preenchida automaticamente, carregada instantaneamente pelo frontend com Realtime para atualizações em background.

---

## Componentes

### 1. Nova tabela: `fin_dashboard_cache`
Singleton que armazena o snapshot completo do dashboard:
- `id` TEXT PRIMARY KEY ('singleton')
- `dashboard_data` JSONB — objeto completo `DashboardData` (receitas, despesas, lucro, contas, categorias, evolução mensal, comparativo, tendências, saldo Asaas)
- `periodo` TEXT — período do último cálculo
- `updated_at` TIMESTAMPTZ
- RLS: leitura para authenticated
- Realtime habilitado

### 2. Nova Edge Function: `fin-dashboard-cache-refresh`
Função que:
- Executa a mesma lógica de cálculo que o frontend faz hoje (queries de lançamentos, contas, reembolsos, evolução mensal, comparativo, Asaas)
- Salva o resultado na tabela `fin_dashboard_cache` via service_role
- Calcula para os 4 períodos (mes_atual, mes_anterior, trimestre, ano) e armazena todos

### 3. Frontend `FinanceiroExecutivoDashboard.tsx`
- **Ao abrir**: carregar dados da `fin_dashboard_cache` (query instantânea)
- **Realtime**: assinar canal para atualizações automáticas
- **Botão "Atualizar"**: chama a Edge Function para forçar refresh
- **Fallback**: se cache vazio, executa lógica atual normalmente

### 4. pg_cron
Agendar `fin-dashboard-cache-refresh` a cada 1h para manter dados frescos.

---

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | **Criar** — tabela `fin_dashboard_cache` + Realtime |
| `supabase/functions/fin-dashboard-cache-refresh/index.ts` | **Criar** — lógica de cálculo e salvamento |
| `src/components/financeiro/FinanceiroExecutivoDashboard.tsx` | **Editar** — carregar do cache + Realtime |
| pg_cron | **Configurar** — agendar refresh a cada 1h |

