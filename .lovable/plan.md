

# Distribuição de Tarefas por Colaborador — Nova Página ADVBox

## Resumo
Criar uma nova página `/distribuicao-tarefas` no submenu "Produção Jurídica" que permite à coordenação visualizar a carga de tarefas por colaborador com ranking, filtros temporais e atalho para criar tarefas diretamente para um colaborador.

## O que será construído

### 1. Nova página `src/pages/DistribuicaoTarefas.tsx`
- **Filtros temporais**: Dia, Semana, Mês, Todos (filtra por `due_date` das tarefas pendentes/em andamento)
- **Tabela/Ranking de colaboradores**: Ordenada por quantidade de tarefas (menor → maior), com colunas:
  - Posição no ranking
  - Nome do colaborador
  - Tarefas pendentes
  - Tarefas em andamento
  - Total de tarefas ativas
  - Botão "Criar Tarefa" como atalho
- **Indicadores visuais**: Badges coloridos para volume (verde = poucos, amarelo = médio, vermelho = muitos)
- **Cards de resumo**: Total de tarefas ativas, média por colaborador, colaborador mais livre, colaborador mais carregado
- **Clique no colaborador**: Abre diálogo de criação de tarefa com o campo "Responsável" já pré-preenchido

### 2. Criação de tarefa via atalho
- Reutiliza o componente `TaskCreationForm` existente (mesmo usado em andamentos/publicações)
- Pré-preenche o responsável selecionado via `prefillResponsibleId`
- Mantém todos os campos: tipo de tarefa, processo, prazo, urgência, convidados, etc.
- Busca `advboxUsers` e `taskTypes` da API do ADVBox (mesma lógica de `TarefasAdvbox.tsx`)

### 3. Fonte de dados
- Consulta a tabela `advbox_tasks` filtrando `status != 'completed'`
- Agrupa por `assigned_users` (campo texto com nome do colaborador)
- Aplica filtro temporal sobre `due_date`

### 4. Integração no menu
- Adicionar item no grupo "Produção Jurídica" do `AppSidebar.tsx`
- Rota: `/distribuicao-tarefas`
- Condição: `isSocio || isAdmin` (mesma restrição do Controle de Prazos)
- Ícone: `Users` (distribuição)

### 5. Rota no `App.tsx`
- Adicionar rota protegida `/distribuicao-tarefas` apontando para `DistribuicaoTarefas`

## Arquivos alterados
1. **`src/pages/DistribuicaoTarefas.tsx`** — nova página completa
2. **`src/components/AppSidebar.tsx`** — adicionar item no submenu
3. **`src/App.tsx`** — adicionar rota

## Detalhes técnicos
- Dados vêm da tabela `advbox_tasks` (já sincronizada via cron)
- O campo `assigned_users` é texto livre (ex: "João Silva, Maria Santos") — será feito split por vírgula para contar por colaborador
- A criação de tarefa usa `supabase.functions.invoke('advbox-integration/create-task')` (já existente)
- Sem necessidade de migrations — usa tabelas existentes

