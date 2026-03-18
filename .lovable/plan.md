

# Módulo de Gestão de Tarefas do CRM

## Resumo

Criar componente `CRMTasks.tsx` com lista de tarefas pendentes, calendário mensal, formulário de criação, widget de resumo semanal e notificações automáticas. Utilizar a tabela `crm_activities` já existente, adicionando coluna `priority`.

## 1. Migração: adicionar `priority` à tabela `crm_activities`

```sql
ALTER TABLE public.crm_activities ADD COLUMN priority TEXT DEFAULT 'medium';
```

Valores: `low`, `medium`, `high`, `urgent`.

## 2. Criar `src/components/crm/CRMTasks.tsx`

Componente principal com:

**Widget "Resumo da Semana"** (topo):
- 3 cards: Atrasadas (vermelho), Vencendo Hoje (amarelo), Concluídas esta semana (verde)
- Conta baseada em `due_date` vs hoje e `completed`

**Duas visualizações** (toggle Lista / Calendário):

**Lista de Tarefas Pendentes**:
- Tabela com: Título, Tipo (badge com ícone), Prioridade (badge colorido), Vencimento, Contato/Negociação vinculado, Status
- Filtros: tipo, prioridade, responsável
- Botões: marcar concluída, editar, excluir
- Ordenação por vencimento (atrasadas primeiro)

**Calendário Mensal**:
- Grid de dias do mês com tarefas plotadas por `due_date`
- Navegação mês anterior/próximo
- Tarefas exibidas como badges coloridos por tipo dentro de cada célula
- Clicar em tarefa abre detalhes

**Dialog de Criação/Edição**:
- Campos: Título, Tipo (Ligação/Email/Reunião/Follow-up), Prioridade (Baixa/Média/Alta/Urgente), Data/Hora de vencimento (datetime-local input), Descrição
- Seletor "Vincular a": com tabs Negociação / Contato / Empresa
  - Negociação: Select buscando `crm_deals`
  - Contato: Select buscando `crm_contacts`
  - Empresa: Select buscando `crm_contacts` agrupado por `company` (distinct)
- Salva em `crm_activities` com `created_by = user.id`

**Notificações**:
- Ao criar/concluir tarefa, inserir registro em `user_notifications` para o `owner_id`
- Na verificação periódica (ao carregar o componente), checar tarefas com `due_date` nas próximas 24h não concluídas e gerar notificação

## 3. Editar `src/components/crm/CRMDashboard.tsx`

- Importar `CRMTasks`
- Adicionar nova aba "Tarefas" com ícone `CheckSquare` entre "Atividades" e "Análises"
- `<TabsContent value="tasks"><CRMTasks /></TabsContent>`

## 4. Editar `src/components/crm/index.ts`

- Exportar `CRMTasks`

## Arquivos

1. **Migration SQL** — `ALTER TABLE crm_activities ADD COLUMN priority`
2. **`src/components/crm/CRMTasks.tsx`** (novo) — componente completo
3. **`src/components/crm/CRMDashboard.tsx`** — adicionar aba "Tarefas"
4. **`src/components/crm/index.ts`** — exportar CRMTasks

