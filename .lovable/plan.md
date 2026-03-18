

# Melhorias na Visão de Lista do CRM

## O que ja existe
O componente `CRMDealsListView.tsx` ja tem: tabela com 7 colunas, ordenacao, filtros por responsavel/etapa/periodo, checkboxes com acao em lote de mover etapa, toggle Kanban/Lista.

## O que falta implementar

### 1. Editar `CRMDealsKanban.tsx` — Persistir viewMode em localStorage
- Trocar `useState('kanban')` por `useState(() => localStorage.getItem('crm-view-mode') || 'kanban')`
- Salvar no localStorage ao mudar

### 2. Editar `CRMDealsListView.tsx` — Adicionar funcionalidades faltantes

**Busca por texto:**
- Input de busca no topo dos filtros, filtrando `deal.name` com `.toLowerCase().includes()`

**Filtro por Status:**
- Select com opcoes: Todos, Aberta, Ganha, Perdida

**Filtro por range de valor:**
- Dois inputs (Valor min / Valor max) adicionados a barra de filtros

**Paginacao:**
- State `page` e `pageSize` (10/25/50)
- Exibir slice dos dados filtrados/ordenados
- Controles de paginacao no rodape (anterior/proximo + seletor de itens por pagina)

**Acoes em lote adicionais:**
- "Atribuir Responsavel": Select com profiles + botao Aplicar, faz update em `crm_deals.owner_id` para os selecionados
- "Mudar Status": Select (Ganha/Perdida/Reabrir), faz update de `won` e `closed_at`
- "Exportar CSV": gera CSV com as colunas visiveis dos deals selecionados (ou todos filtrados se nenhum selecionado), faz download via `Blob` + `URL.createObjectURL`
- Para as novas acoes em lote, o componente precisara receber `supabase` access ou callbacks adicionais como props

**Colunas customizaveis:**
- State com Set de colunas visiveis, default todas
- Dropdown "Colunas" com checkboxes para cada coluna
- Persistir em localStorage
- Botao "Restaurar Padrao"

### 3. Editar `CRMDealsKanban.tsx`
- Passar novos callbacks para o ListView: `onBulkAssignOwner`, `onBulkChangeStatus` (ou passar `refreshDeals` e deixar o ListView fazer os updates diretamente via supabase)

## Arquivos modificados
1. `src/components/crm/CRMDealsListView.tsx` — adicionar busca, filtro status, filtro valor, paginacao, acoes em lote, colunas customizaveis, exportacao CSV
2. `src/components/crm/CRMDealsKanban.tsx` — persistir viewMode em localStorage, passar props extras

## Sem mudancas no banco de dados
Todas as funcionalidades usam dados e tabelas ja existentes.

