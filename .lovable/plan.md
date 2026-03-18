

# Melhorias nas Tarefas do CRM

## O que ja existe
- Visao de Lista com filtros (tipo, prioridade, responsavel) e ordenacao
- Visao de Calendario mensal
- Dialog de criacao/edicao (titulo, tipo, prioridade, data/hora, descricao, vinculo deal/contato)
- Acoes: concluir, editar, excluir
- Resumo semanal (atrasadas, vencendo hoje, concluidas)
- Notificacoes para tarefas proximas do vencimento

## O que falta implementar

### 1. Adicionar coluna `status` na tabela `crm_activities`
- Migração: `ALTER TABLE crm_activities ADD COLUMN status TEXT DEFAULT 'pending'`
- Valores: pending, in_progress, completed, cancelled
- Atualizar registros existentes: `completed = true` vira `status = 'completed'`

### 2. Visao Kanban (por status)
- 4 colunas: Pendente, Em Progresso, Concluida, Cancelada
- Cards com titulo, tipo, prioridade e data
- Clicar no card abre edicao

### 3. Visao Agenda (proximos 7 dias)
- Lista agrupada por dia (Hoje, Amanha, etc)
- Mostra tarefas pendentes ordenadas por horario

### 4. Filtros adicionais
- Filtro por status (pendente/em progresso/concluida/cancelada)
- Toggle "Minhas tarefas" vs "Todas"
- Filtro por periodo (data inicio/fim)

### 5. Melhorias no formulario
- Seletor de responsavel (dropdown com profiles)
- Botao "Duplicar tarefa" na lista

### 6. Atualizar logica de conclusao
- Usar `status = 'completed'` em vez de apenas `completed = true`
- Permitir mudar status diretamente na lista

## Arquivos modificados
1. **Migração SQL** — adicionar coluna `status` a `crm_activities`
2. **`src/components/crm/CRMTasks.tsx`** — adicionar Kanban, Agenda, filtros, duplicar, seletor responsavel

## Fora de escopo nesta iteracao
Subtarefas, comentarios e lembretes exigiriam 3 novas tabelas e componentes complexos — podem ser adicionados depois se necessario.

