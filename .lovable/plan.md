

## Adicionar linha de totais na tabela de pagamentos

### O que será feito
Adicionar uma linha de rodapé (`tfoot`) na tabela de pagamentos que soma todos os valores de Vantagens, Descontos e Líquido do mês filtrado, permitindo conferência rápida do total.

### Implementação

**Arquivo: `src/components/rh/RHPagamentos.tsx`**

Após o `</TableBody>` (linha 1557), adicionar um `<tfoot>` com uma `TableRow` de totais:

- Colunas vazias para checkbox, colaborador, mês
- **Total Vantagens** (verde): soma de `pag.total_vantagens` de todos os pagamentos
- **Total Descontos** (vermelho): soma de `pag.total_descontos`
- **Total Líquido** (negrito): soma de `pag.total_liquido`
- Colunas vazias para status e ações
- Label "TOTAL" na coluna do colaborador em negrito
- Background destacado (`bg-muted`) para diferenciar visualmente
- Só aparece quando há pagamentos (`pagamentos.length > 0`)

Os totais serão calculados inline com `pagamentos.reduce()`, usando o `formatCurrency` já existente.

