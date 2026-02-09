
# Pipeline de Dados de Tarefas ADVBox com Dashboard e Perfil

## Problema Atual

1. **Carregamento lento**: Toda vez que a pagina de tarefas e aberta, o sistema faz chamadas diretas a API do ADVBox com paginacao completa (ate 100 paginas x 100 itens = 10.000 tarefas), causando latencia de 20s+.
2. **Cache apenas em memoria**: O cache atual esta no edge function (em memoria da instancia) e no localStorage do navegador -- ambos volateis e inconsistentes.
3. **Sem dados persistentes**: Nao existe tabela no banco para armazenar tarefas do ADVBox, impedindo consultas rapidas.
4. **Dashboard incompleto**: A pagina de produtividade (`RelatoriosProdutividadeTarefas`) depende da mesma chamada lenta a API.
5. **Perfil do colaborador sem dados**: Tanto `ColaboradorPerfilUnificado` quanto `RHColaboradorDashboard` fazem chamadas diretas a API para buscar tarefas, resultando em dados vazios ou incompletos.

## Solucao Proposta

Criar um pipeline de dados que sincroniza tarefas do ADVBox para o banco de dados, permitindo consultas instantaneas e atualizacoes incrementais.

---

## 1. Criar Tabela `advbox_tasks` no Banco

Tabela para armazenar todas as tarefas sincronizadas do ADVBox:

```text
advbox_tasks:
  - id (uuid, PK)
  - advbox_id (integer, unique) -- ID original no ADVBox
  - title (text) -- nome da tarefa
  - description (text) -- notas/descricao
  - due_date (timestamptz) -- data limite
  - completed_at (timestamptz) -- data de conclusao
  - status (text) -- pending, completed
  - assigned_users (text) -- nomes dos responsaveis (comma-separated)
  - assigned_user_ids (jsonb) -- IDs dos responsaveis no ADVBox
  - process_number (text) -- numero do processo vinculado
  - lawsuit_id (integer) -- ID do processo no ADVBox
  - task_type (text) -- tipo/nome da tarefa
  - task_type_id (integer) -- ID do tipo
  - points (integer, default 1) -- pontuacao da tarefa
  - raw_data (jsonb) -- payload completo original do ADVBox
  - synced_at (timestamptz) -- quando foi sincronizado
  - created_at, updated_at (timestamptz)
```

Tabela de controle de sincronizacao:

```text
advbox_tasks_sync_status:
  - id (uuid, PK)
  - last_offset (integer, default 0)
  - total_synced (integer, default 0)
  - total_count (integer)
  - status (text) -- idle, running, completed, error
  - last_error (text)
  - started_at (timestamptz)
  - completed_at (timestamptz)
  - created_at, updated_at (timestamptz)
```

RLS: Leitura para usuarios aprovados, escrita apenas via service role.

---

## 2. Edge Function `sync-advbox-tasks`

Nova edge function dedicada a sincronizacao:

- **Modo completo** (`full_sync`): Busca todas as tarefas com paginacao, salva no banco usando upsert por `advbox_id`.
- **Modo incremental** (`incremental`): Busca apenas as tarefas das ultimas 24-48h (se a API suportar filtro por data) ou faz sync completo e usa upsert para nao duplicar.
- **Controle de estado**: Usa a tabela `advbox_tasks_sync_status` para registrar progresso, permitindo monitoramento.
- **Batch upsert**: Insere em lotes de 500 registros com `ON CONFLICT (advbox_id) DO UPDATE`.
- **Rate limiting**: Delay de 1.5s entre paginas da API ADVBox.

---

## 3. Automacao via pg_cron

Configurar sincronizacao automatica a cada 15 minutos:

```text
pg_cron: sync-advbox-tasks a cada 15 minutos
```

Isso garante que os dados estejam sempre atualizados sem depender de acao manual.

---

## 4. Atualizar Pagina de Tarefas (`TarefasAdvbox.tsx`)

Mudancas:
- **Fonte de dados**: Trocar de `supabase.functions.invoke('advbox-integration/tasks')` para `supabase.from('advbox_tasks').select(...)`.
- **Carregamento instantaneo**: Consulta ao banco e rapida (ms vs 20s+).
- **Botao "Atualizar"**: Ao clicar, dispara `sync-advbox-tasks` e depois faz refetch do banco.
- **Remover cache localStorage**: Nao e mais necessario, dados vem do banco.
- **Manter filtros e funcionalidades existentes** (prioridades, status, responsavel, etc).

---

## 5. Dashboard Completo de Tarefas (nova aba ou pagina melhorada)

Melhorar `RelatoriosProdutividadeTarefas.tsx` com dados do banco:

**KPIs Gerais:**
- Total de tarefas no periodo
- Total concluidas / pendentes / atrasadas
- Taxa de conclusao (%)
- Total de pontos

**Por Colaborador (tabela + graficos):**
- Nome do colaborador
- Tarefas atribuidas
- Tarefas concluidas
- Tarefas pendentes
- Tarefas atrasadas (due_date < hoje e status = pending)
- Total de pontos
- Taxa de conclusao (%)

**Graficos:**
- Barras comparativas por colaborador
- Evolucao mensal (line chart)
- Distribuicao por status (pie chart)

Tudo consultado diretamente do banco, sem chamadas a API externa.

---

## 6. Corrigir Perfil do Colaborador

**`ColaboradorPerfilUnificado.tsx`:**
- Trocar `supabase.functions.invoke('advbox-integration/tasks')` por query ao banco `advbox_tasks`.
- Filtrar por `assigned_users ILIKE '%nome%'`.
- Agrupar por mes para gerar estatisticas.
- Incluir total de pontos por mes.

**`RHColaboradorDashboard.tsx`:**
- Mesma abordagem: consultar `advbox_tasks` ao inves de chamar edge function.
- Dados instantaneos sem latencia.

---

## Resumo das Alteracoes

| Componente | Alteracao |
|---|---|
| **Migracao SQL** | Criar tabelas `advbox_tasks` e `advbox_tasks_sync_status` com indices e RLS |
| **Edge Function** `sync-advbox-tasks` (nova) | Sincronizacao paginada com upsert em batch |
| **pg_cron** | Agendar sync a cada 15 minutos |
| **`TarefasAdvbox.tsx`** | Ler do banco, botao atualizar dispara sync |
| **`RelatoriosProdutividadeTarefas.tsx`** | Dashboard completo com KPIs e graficos por colaborador, lendo do banco |
| **`ColaboradorPerfilUnificado.tsx`** | Consultar `advbox_tasks` para pontuacao e tarefas |
| **`RHColaboradorDashboard.tsx`** | Consultar `advbox_tasks` para estatisticas mensais |
| **`AppSidebar.tsx`** | Atualizar contagem de tarefas criticas do banco |

## Beneficios

- Carregamento de tarefas: de ~20s para menos de 1s
- Dados sempre disponiveis, mesmo offline ou com API fora
- Dashboard completo com metricas por colaborador
- Perfil do colaborador com dados reais de desempenho
- Atualizacoes incrementais sem apagar dados anteriores
