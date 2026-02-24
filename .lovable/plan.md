

## Corrigir Erro de Unique Constraint ao Editar Pagamento

### Problema

Ao clicar em "Salvar Alterações" no dialog de editar pagamento, o sistema mostra:
> "Erro ao atualizar pagamento: duplicate key value violates unique constraint rh_pagamentos_colaborador_id_mes_referencia_key"

### Causa Raiz

Na funcao `handleSaveEdit` (linha 1002-1014 de `RHPagamentos.tsx`), o UPDATE sempre reenvia o campo `mes_referencia` com a conversao `editMesReferencia + '-01'`. Mesmo que o valor nao tenha sido alterado, o PostgreSQL tenta validar a constraint unique `(colaborador_id, mes_referencia)` durante o update. Se houver qualquer inconsistencia de formato ou se o trigger `sync_rh_pagamento_to_financeiro` dispara e faz um segundo UPDATE na mesma tabela (linha que faz `UPDATE rh_pagamentos SET lancamento_financeiro_id = ... WHERE id = NEW.id`), isso pode causar recursao que viola a constraint.

O trigger `sync_rh_pagamento_to_financeiro` (linhas que fazem UPDATE na propria tabela `rh_pagamentos` dentro de um trigger AFTER UPDATE) e a causa mais provavel da recursao: o UPDATE original dispara o trigger, que faz outro UPDATE na mesma linha (para setar `lancamento_financeiro_id`), que dispara o trigger novamente, e na segunda execucao tenta inserir um novo lancamento e atualizar `rh_pagamentos` novamente.

### Solucao

**Arquivo:** `src/components/rh/RHPagamentos.tsx`

1. **Remover `mes_referencia` do UPDATE quando nao mudou**: Comparar `editMesReferencia + '-01'` com `editingPagamento.mes_referencia`. Se for igual, nao incluir no objeto de update. Isso evita que o PostgreSQL reavalie a constraint desnecessariamente.

2. **Nao incluir `mes_referencia` no update por padrao**: Na maioria das edicoes, o usuario esta apenas alterando valores de rubricas, nao o mes de referencia. O campo `mes_referencia` so deve ser incluido no UPDATE se o usuario efetivamente mudou o mes.

### Implementacao

Na funcao `handleSaveEdit`, substituir o bloco de update (linhas 1001-1014) por:

```typescript
const updateData: any = {
  data_pagamento: editDataPagamento,
  status: editStatus,
  observacoes: editObservacoes || editingPagamento.observacoes,
  total_vantagens: totaisEdit.vantagens,
  total_descontos: totaisEdit.descontos,
  total_liquido: totaisEdit.liquido,
  updated_at: new Date().toISOString()
};

// Só incluir mes_referencia se realmente mudou
const novoMesRef = editMesReferencia + '-01';
if (novoMesRef !== editingPagamento.mes_referencia.substring(0, 10)) {
  updateData.mes_referencia = novoMesRef;
}

const { error } = await supabase
  .from('rh_pagamentos')
  .update(updateData)
  .eq('id', editingPagamento.id);
```

### Arquivo a modificar

1. `src/components/rh/RHPagamentos.tsx` — funcao `handleSaveEdit`, bloco de update (~linhas 1001-1014)

