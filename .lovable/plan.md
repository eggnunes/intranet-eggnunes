

# Dashboard de Viabilidade

## Resumo
Criar uma nova página de Viabilidade com dashboard de clientes, incluindo cards de estatísticas, tabela, filtros, busca e modal de criação.

## Implementação

### 1. Nova tabela `viabilidade_clientes` (migração SQL)
Campos: `id` (UUID), `nome` (TEXT), `cpf` (TEXT), `status` (TEXT default 'pendente' — valores: pendente, em_analise, revisado), `observacoes` (TEXT), `created_by` (UUID), `created_at`, `updated_at`. RLS para authenticated com `is_approved`.

### 2. Nova página `src/pages/Viabilidade.tsx`
- **4 cards de estatísticas** no topo: Total (azul), Em Análise (âmbar), Revisados (verde), Pendentes (vermelho) — com ícones `Users`, `Clock`, `CheckCircle`, `AlertCircle`
- **Filtros**: Select por status + Input de busca por nome/CPF
- **Tabela**: últimos 10 clientes com Nome, CPF (mascarado), Status (Badge colorido com ícone), Data Criação, Ações (editar/excluir)
- **Botão "Novo Cliente"**: abre Dialog com campos nome, CPF, status, observações
- Badges de status: `pendente` = vermelho, `em_analise` = âmbar, `revisado` = verde

### 3. Rota e sidebar
- Rota `/viabilidade` em `App.tsx` com `ProtectedRoute`
- Link no `AppSidebar.tsx` na seção Setor Comercial com ícone `ClipboardCheck`

### Arquivos
1. **Migração SQL** — tabela `viabilidade_clientes` + RLS
2. **`src/pages/Viabilidade.tsx`** (novo)
3. **`src/App.tsx`** — rota
4. **`src/components/AppSidebar.tsx`** — link no menu

