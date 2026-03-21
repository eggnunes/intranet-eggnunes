

## Renomear "Decisões Favoráveis" → "Jurisprudência Interna" + Verificar Ordenação

### Análise

1. **Nome no sidebar**: O único lugar que ainda mostra "Decisões Favoráveis" é o menu lateral em `AppSidebar.tsx` (linha 211). A página em si já tem o título "Jurisprudência Interna".

2. **Ordenação**: A query já faz `.order('created_at', { ascending: false })` — ou seja, as últimas cadastradas aparecem primeiro. O `filteredDecisions` aplica apenas `.filter()` sem `.sort()`, então a ordem é preservada. **Porém**, a tabela exibe a coluna `decision_date` (data da decisão), não `created_at` (data do cadastro). Isso pode causar a impressão de desordem — uma decisão de 2023 cadastrada ontem aparece no topo mas com data antiga.

### Alterações

**1. `src/components/AppSidebar.tsx`** (linha 211)
- Trocar label de `'Decisões Favoráveis'` para `'Jurisprudência Interna'`

**2. `src/pages/DecisoesFavoraveis.tsx`**
- Adicionar coluna "Cadastro" na tabela mostrando `created_at` formatado, para o usuário visualizar claramente a ordem cronológica de cadastramento
- Manter a ordenação existente por `created_at desc` (já está correta)

