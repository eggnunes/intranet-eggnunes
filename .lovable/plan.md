

# Puxar Tipos de Ação do ADVBox/CRM/Leads na Viabilidade

## Problema
O seletor "Tipo de Ação" no formulário de nova viabilidade usa valores fixos (Cível, Trabalhista, Previdenciário, Tributário). O usuário quer que as opções venham dinamicamente das fontes de dados existentes.

## Solução

### Alteração em `src/pages/ViabilidadeNovo.tsx`

1. **Buscar tipos de ação dinamicamente** ao carregar a página:
   - Consultar `DISTINCT product_name` de `contract_drafts` (ADVBox/contratos)
   - Consultar `DISTINCT product_name` de `crm_deals` (CRM)
   - Consultar `DISTINCT product_name` de `captured_leads` (Leads)
   - Unificar os resultados removendo duplicatas e valores nulos
   - Manter os 4 tipos fixos como fallback caso nenhum dado seja encontrado

2. **Trocar o Select por um Combobox com busca**:
   - Permitir selecionar um tipo existente da lista combinada
   - Permitir digitar um tipo personalizado caso não exista na lista
   - Agrupar visualmente por fonte (ADVBox, CRM, Leads) para facilitar identificação

3. **Lógica de carregamento**:
   - `useEffect` na montagem do componente com 3 queries paralelas
   - Merge + deduplica por nome (case-insensitive)
   - Estado `tiposAcaoOptions` com loading state

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/pages/ViabilidadeNovo.tsx` | Remover array estático `tiposAcao`, adicionar `useEffect` para buscar `product_name` de 3 tabelas, trocar `Select` por combo pesquisável com fallback |

- Queries: `supabase.from('contract_drafts').select('product_name')`, `supabase.from('crm_deals').select('product_name')`, `supabase.from('captured_leads').select('product_name')`
- Deduplica com `Set` normalizado por `toLowerCase()`
- Mantém os 4 tipos fixos mesclados com os dinâmicos
- Nenhuma migração de banco necessária

