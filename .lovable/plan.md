

# Visão de Lista para Negociações do CRM

## Resumo

Adicionar um toggle no topo da aba "Pipeline" para alternar entre "Visão de Funil" (Kanban atual) e "Visão de Lista" (tabela). A visão de lista terá: tabela com colunas ordenáveis, checkboxes para ações em lote, e filtros avançados.

## Arquivos

### 1. Criar `src/components/crm/CRMDealsListView.tsx` (novo)

Componente de tabela com:
- **Colunas**: Checkbox, Nome da Negociação, Responsável, Qualificação (lead_score do contato), Etapa do Funil, Valor Total, Data de Criação, Status (aberta/ganha/perdida)
- **Ordenação**: State `sortColumn` + `sortDirection`, clicando no header alterna asc/desc. Ícones ArrowUpDown/SortAsc/SortDesc nos headers
- **Filtros avançados**: Barra com filtros por período (data de criação de/até), responsável (Select com owners), etapa (Select com stages). Botão "Limpar filtros"
- **Checkboxes + Ações em lote**: State `selectedDeals: Set<string>`. Header checkbox seleciona/deseleciona todos. Quando há selecionados, exibe barra com "X selecionados" + Select "Mover para etapa" + botão "Aplicar". Reutiliza a lógica `moveDeal` existente no Kanban
- **Dados**: Recebe `deals`, `stages`, `profiles` como props (mesmos dados já carregados pelo Kanban), evitando queries duplicadas

### 2. Editar `src/components/crm/CRMDealsKanban.tsx`

- Adicionar state `viewMode: 'kanban' | 'list'` (default: `'kanban'`)
- Acima do Kanban, renderizar toggle group (ToggleGroup do shadcn) com ícones LayoutGrid + List para alternar
- Quando `viewMode === 'list'`, renderizar `<CRMDealsListView>` passando `deals`, `stages`, `profiles`, `formatCurrency`, e função `handleMoveDeal`
- Quando `viewMode === 'kanban'`, renderizar o Kanban atual (sem mudanças)
- Extrair a função `moveDeal` (já existente) para ser reutilizada por ambas as views

### 3. Editar `src/components/crm/index.ts`

- Exportar `CRMDealsListView` (opcional, já que será usado internamente pelo Kanban)

## Detalhes Técnicos

- Sem mudanças no banco de dados — todos os dados necessários já estão disponíveis
- A ação em lote de mover etapa chamará a mesma lógica de `moveDeal` em loop para cada deal selecionado, com sync ao RD Station se habilitado
- Ordenação e filtros serão client-side (dados já carregados em memória)
- Componentes UI: `Table`, `Checkbox`, `ToggleGroup`, `Select`, `Input`, `Badge`, `Button`

