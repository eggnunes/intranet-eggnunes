

# Cache Persistente do Dashboard de Processos no Banco de Dados

## Problema
Toda vez que o Dashboard de Processos é aberto, os números aparecem zerados e o sistema precisa chamar a API do ADVBox para carregar os dados. O cache atual usa `localStorage`, que é volátil e precisa de refresh a cada visita.

## Solução
Criar uma tabela no banco que armazena um **snapshot dos números do dashboard** (contadores, totais). A Edge Function `advbox-integration` salva esses números sempre que uma sincronização completa termina. O frontend lê esse snapshot instantaneamente ao abrir a página — sem esperar API. Quando uma atualização ocorre em background, o frontend recebe os novos dados automaticamente via **Realtime**.

---

## Componentes

### 1. Nova tabela: `advbox_dashboard_cache`
Armazena os contadores e dados resumidos do dashboard:
- `id` (sempre 1, registro único — singleton)
- `total_lawsuits` (int) — total de processos
- `total_movements` (int) — total de movimentações
- `lawsuits_data` (jsonb) — array completo dos processos (compactado)
- `movements_data` (jsonb) — array completo das movimentações
- `metadata` (jsonb) — metadados da última sync
- `updated_at` (timestamptz) — quando foi atualizado por último
- RLS: leitura para authenticated, escrita via service_role
- Realtime habilitado para notificar o frontend de atualizações

### 2. Edge Function `advbox-integration` — Atualização
Após buscar processos/movimentações da API ADVBox, salvar os dados na tabela `advbox_dashboard_cache` usando upsert com service_role.

### 3. Frontend `ProcessosDashboard.tsx` — Atualização
- **Ao abrir**: Buscar dados da tabela `advbox_dashboard_cache` (query instantânea ao banco, sem chamar Edge Function)
- **Realtime**: Assinar canal Realtime na tabela para receber atualizações automáticas quando a Edge Function salvar novos dados
- **Botão "Atualizar"**: Continua chamando a Edge Function para forçar refresh, mas agora ela salva no banco e o Realtime entrega os dados novos
- Manter `localStorage` como fallback offline

### 4. Agendamento automático (pg_cron)
Agendar a Edge Function `advbox-cache-refresh` para rodar periodicamente (a cada 2h por exemplo), mantendo os dados sempre atualizados no banco sem que o usuário precise abrir a página.

---

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | **Criar** — tabela `advbox_dashboard_cache` + Realtime |
| `supabase/functions/advbox-integration/index.ts` | **Editar** — salvar dados na nova tabela após sync |
| `src/pages/ProcessosDashboard.tsx` | **Editar** — carregar do banco + assinar Realtime |
| pg_cron | **Configurar** — agendar refresh automático |

