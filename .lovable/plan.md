

# Corrigir lógica de status na Viabilidade Jurídica

## Problema
Ao salvar um cliente após análise de IA, o status é automaticamente definido como "revisado" (linhas 278-281 de `ViabilidadeNovo.tsx`). O usuário quer:
- **Sem análise** → status = `pendente`
- **Com análise feita** → status = `em_analise`
- **Revisado** → somente quando o usuário clicar manualmente em um botão "Marcar como Revisado"

## Alterações

### 1. `src/pages/ViabilidadeNovo.tsx` — Corrigir lógica de status ao salvar
Substituir a lógica atual (linhas 278-281):
```
// ANTES: viavel/inviavel → revisado
// DEPOIS: com parecer → em_analise, sem parecer → pendente
let status = parecer ? 'em_analise' : 'pendente';
```

### 2. `src/pages/Viabilidade.tsx` — Adicionar botão "Marcar como Revisado"
Na listagem de clientes, adicionar um botão/ação para que o usuário possa manualmente alterar o status de `em_analise` para `revisado`. Isso pode ser um botão na linha do cliente ou um dropdown de ação.

| Arquivo | Alteração |
|---|---|
| `src/pages/ViabilidadeNovo.tsx` | Simplificar lógica: `pendente` (sem análise) ou `em_analise` (com análise). Nunca `revisado` automaticamente. |
| `src/pages/Viabilidade.tsx` | Adicionar botão "Marcar como Revisado" nos clientes com status `em_analise` |

