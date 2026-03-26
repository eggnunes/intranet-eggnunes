

## Adicionar mais detalhes nas tarefas do ADVBox

### Problema atual
A listagem de tarefas mostra apenas: título, status, data de vencimento e responsável. Faltam informações como número do processo, tipo de tarefa, data de conclusão, nome do cliente (disponível no `raw_data`) e data de criação.

### O que será feito

#### 1. Buscar mais campos do banco
**Arquivo:** `src/pages/TarefasAdvbox.tsx`

- Na query do `fetchTasks` (linha 257), adicionar os campos: `task_type`, `lawsuit_id`, `completed_at`, `created_at`, `raw_data`
- Expandir a interface `Task` para incluir: `task_type`, `lawsuit_id`, `completed_at`, `created_at`, `client_name`
- No mapeamento dos dados, extrair o nome do cliente de `raw_data.lawsuit.customers[0].name`

#### 2. Enriquecer o card de cada tarefa na lista
**Arquivo:** `src/pages/TarefasAdvbox.tsx` (linhas 912-976)

Adicionar na área de metadados de cada card (abaixo do título):
- **Data de vencimento** (já existe)
- **Responsável** (já existe)
- **Número do processo** — com ícone de FileText
- **Tipo de tarefa** — com Badge secundário
- **Cliente** — extraído do raw_data
- **Data de criação** — "Criada em dd/MM/yyyy"
- **Data de conclusão** — se concluída, "Concluída em dd/MM/yyyy"

#### 3. Enriquecer o painel de detalhes (Dialog/Drawer)
**Arquivo:** `src/pages/TarefasAdvbox.tsx` (linhas 1349-1373 e 1279-1296)

Adicionar seção de informações detalhadas antes das tabs:
- Processo, tipo, cliente, data de criação, conclusão, lawsuit_id
- Organizar em grid 2 colunas para melhor visualização

### Arquivos modificados
- `src/pages/TarefasAdvbox.tsx` — interface, query, cards e painel de detalhes

### Resultado
- Cada tarefa na lista mostrará processo, tipo, cliente, datas
- O painel de detalhes terá seção completa de informações
- Dados vêm do banco (campos existentes + raw_data), sem chamadas extras à API

