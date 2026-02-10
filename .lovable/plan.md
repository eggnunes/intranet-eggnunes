
# Edição Completa de Pagamentos - Rubricas Detalhadas

## Problema Atual
O botão "Editar" nos pagamentos abre um dialog simples que permite alterar apenas mês de referência, data, status e observações. Não é possível visualizar ou editar as rubricas individuais (vantagens e descontos) de um pagamento já registrado.

## Solução
Expandir o dialog de edição para carregar todas as rubricas do pagamento (`rh_pagamento_itens`) e permitir alteração completa dos valores, com recálculo automático dos totais.

---

## Arquivo a Modificar

### `src/components/rh/RHPagamentos.tsx`

**Mudanças:**

1. **Novos estados para edição detalhada:**
   - `editItens`: Record com os itens de pagamento carregados (rubrica_id -> valor/observação)
   - `editDisplayValues`: Valores formatados para inputs
   - `loadingEditItens`: Loading ao carregar itens

2. **Função `handleEditPagamento` atualizada:**
   - Ao abrir o dialog de edição, buscar `rh_pagamento_itens` do pagamento selecionado junto com as rubricas
   - Popular o estado `editItens` com os valores atuais
   - Detectar o cargo do colaborador para filtrar rubricas corretamente (reutilizar lógica existente de `getVantagensFiltradas`/`getDescontosFiltrados`)

3. **Função `handleSaveEdit` atualizada:**
   - Recalcular `total_vantagens`, `total_descontos` e `total_liquido` com base nos itens editados
   - Deletar itens antigos: `DELETE FROM rh_pagamento_itens WHERE pagamento_id = X`
   - Inserir novos itens com valores atualizados
   - Atualizar totais no `rh_pagamentos`

4. **Dialog de edição expandido:**
   - Usar `max-w-3xl` (mesmo tamanho do dialog de criação)
   - Adicionar ScrollArea para conteúdo longo
   - Mostrar seção "Vantagens" com inputs para cada rubrica (valor + observação)
   - Mostrar seção "Descontos" com inputs para cada rubrica
   - Mostrar totais calculados em tempo real (vantagens, descontos, líquido)
   - Manter os campos existentes (mês ref., data pagamento, status, observações)

---

## Detalhes Técnicos

### Fluxo de Edição

```text
1. Admin clica "Editar" no pagamento
2. Sistema busca rh_pagamento_itens + rh_rubricas do pagamento
3. Dialog abre com todos os campos e rubricas preenchidos
4. Admin altera valores das rubricas (ex: muda "13o Salário" para "Reembolso")
5. Totais recalculam automaticamente
6. Ao salvar:
   a. Deleta itens antigos (rh_pagamento_itens)
   b. Insere novos itens com valores atualizados
   c. Atualiza totais no rh_pagamentos
```

### Queries

- Carregar itens: `SELECT * FROM rh_pagamento_itens WHERE pagamento_id = ?`
- Carregar rubricas: já disponível no estado `rubricas`
- Detectar cargo: buscar `profiles.cargo_id` do colaborador do pagamento
- Salvar: DELETE + INSERT nos itens, UPDATE nos totais

### Reutilização de Código
- Os inputs de valor usarão a mesma lógica de `maskCurrency` / `parseCurrency` já existente
- A filtragem de rubricas por tipo de cargo reutiliza `getVantagensFiltradas` e `getDescontosFiltrados` (ajustados para aceitar o cargo como parâmetro)
- O layout dos inputs seguirá o mesmo padrão visual do dialog de criação
