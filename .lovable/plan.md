

## Correções na Jurisprudência Interna (Decisões Favoráveis)

### 1. Bug: clicar no resultado não abre a decisão
**Problema**: A tabela de decisões não tem nenhum comportamento de clique na linha. Clicar em "Resultado" (ou qualquer célula) não faz nada — não há dialog de detalhes nem link.

**Correção em `src/pages/DecisoesFavoraveis.tsx`**:
- Adicionar `onClick` na `TableRow` para abrir o dialog de edição (ou um dialog de visualização)
- Como o pedido é que todos possam editar resultado e link (item 2), a solução ideal é: clicar na linha abre um dialog de detalhes/edição rápida com campos de resultado e link editáveis por qualquer colaborador
- Usar `cursor-pointer` e `hover:bg-muted/50` na linha

### 2. Todos podem editar resultado e link
**Problema**: Atualmente, editar e excluir só aparecem para `isSocioOrRafael` (linhas 1111-1129). Colaboradores comuns não podem editar resultado nem link.

**Correção em `src/pages/DecisoesFavoraveis.tsx`**:
- Criar uma mutation `quickEditMutation` que permite qualquer usuário autenticado atualizar apenas `resultado` e `decision_link` na tabela `favorable_decisions`
- Ao clicar na linha da tabela, abrir um dialog simples de "Detalhes da Decisão" mostrando todas as info e com campos editáveis para `resultado` (Select) e `decision_link` (Input), com botão salvar
- O botão de edição completa (Edit) e exclusão (Trash) continuam restritos a sócios

### 3. Filtro por tipo de ação/produto na Jurimetria
**Problema**: O `JurimetriaDashboard` tem filtros de matéria, região e data, mas NÃO tem filtro por `product_name` (tipo de ação/produto).

**Correção em `src/components/JurimetriaDashboard.tsx`**:
- Adicionar `product_name` à interface `Decision` (já existe nos dados passados)
- Adicionar estado `filterProduct` com valor `'all'`
- Calcular `uniqueProducts` a partir dos `decisions`
- Adicionar Select de "Tipo de Ação/Produto" nos filtros (ao lado dos existentes)
- Incluir filtro no `useMemo` de `filtered`

### Arquivos modificados
- `src/pages/DecisoesFavoraveis.tsx` — dialog de detalhes ao clicar, edição rápida de resultado/link por todos
- `src/components/JurimetriaDashboard.tsx` — filtro por produto/ação

