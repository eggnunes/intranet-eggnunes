

# Plano: Excluir Pagamentos Duplicados no RH

## Situação Atual
O componente `RHPagamentos.tsx` já possui:
- Checkboxes de seleção individual e "selecionar todos"
- Estado `selectedForBatch` para rastrear seleções
- Botão de editar e gerar recibo por linha
- Status "cancelado" disponível na edição

**Não existe**: botão de excluir pagamento (nem individual nem em lote).

## Alterações em `src/components/rh/RHPagamentos.tsx`

### 1. Botão "Excluir" individual por linha
- Adicionar ícone `Trash2` (já importado) ao lado do botão de editar em cada linha da tabela
- Ao clicar, abrir `AlertDialog` de confirmação com nome do colaborador e mês

### 2. Exclusão em lote (batch)
- Adicionar botão "Excluir Selecionados" que aparece quando há pagamentos selecionados via checkbox
- Confirmação via `AlertDialog` mostrando quantidade de pagamentos a excluir

### 3. Lógica de exclusão
- Deletar os itens (`rh_pagamento_itens`) vinculados primeiro
- Deletar o pagamento (`rh_pagamentos`)
- Se houver `lancamento_financeiro_id` vinculado, deletar também o lançamento financeiro correspondente (`fin_lancamentos`)
- Atualizar lista local após exclusão
- Pagamentos com `recibo_gerado = true` exibem aviso extra na confirmação ("Este pagamento já teve recibo gerado")

### 4. Proteção
- Confirmação obrigatória antes de excluir
- Toast de sucesso/erro após operação

