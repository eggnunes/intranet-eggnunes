

# Plano: Permitir que qualquer colaborador marque status de avaliação/postagem

## Problema
Os checkboxes "Foi postado", "Avaliação pedida" e "Cliente avaliou" só podem ser alterados via dialog de edição, que é restrito a sócios. Colaboradores não conseguem atualizar esses campos depois que a decisão já foi cadastrada.

## Solução
Transformar os 3 ícones de status na tabela (coluna "Status", linhas 1037-1057) em botões clicáveis que qualquer colaborador pode usar para alternar o valor diretamente, sem precisar abrir o dialog de edição.

## Implementação

1. **Criar mutation inline** para atualizar apenas os campos `was_posted`, `evaluation_requested` e `was_evaluated` individualmente, sem exigir `isSocioOrRafael`.

2. **Substituir os ícones estáticos** na coluna "Status" por botões clicáveis com `onClick` que chamam a mutation inline. Ao clicar, alterna o valor booleano e salva direto no banco.

3. **RLS**: Verificar se a policy de UPDATE da tabela `favorable_decisions` permite que qualquer usuário aprovado faça update nesses campos. Se necessário, criar uma policy que permita update parcial para usuários autenticados.

## Escopo de alteração
- **1 arquivo**: `src/pages/DecisoesFavoraveis.tsx`
  - Adicionar `useMutation` para toggle inline dos 3 campos
  - Trocar os ícones estáticos por botões clicáveis na tabela
- **Possível migration SQL**: Ajustar RLS se a policy atual restringir UPDATE apenas a sócios

