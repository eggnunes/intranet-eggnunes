
## Melhorias no Módulo de Pagamentos de Parceiros

### Contexto e Análise

O sistema atual de pagamentos de parceiros (`parceiros_pagamentos`) já possui:
- Campos: `valor`, `data_vencimento`, `status`, `parcela_atual`, `total_parcelas`, `lancamento_financeiro_id`
- Sincronização automática via função `sync_parceiro_pagamento_to_financeiro` no banco de dados que cria lançamentos no financeiro quando um pagamento é inserido
- A tabela `fin_lancamentos` já tem `lancamento_financeiro_id` referenciado em `parceiros_pagamentos`

O que **falta** implementar conforme solicitado:

1. **Campo de abatimentos** (taxa de cartão, impostos) para calcular o valor líquido a repassar
2. **Parcelas editáveis individualmente** (valor pode variar por parcela)
3. **Marcar parcela como paga** diretamente na tela de detalhes do parceiro
4. **Sincronização bidirecional**: ao pagar no financeiro → aparece como pago no parceiro; ao pagar no parceiro → cria/atualiza o lançamento financeiro como pago

---

### Mudanças no Banco de Dados

**Adicionar colunas à tabela `parceiros_pagamentos`:**

```sql
ALTER TABLE parceiros_pagamentos 
  ADD COLUMN valor_bruto numeric,         -- valor original antes dos abatimentos
  ADD COLUMN valor_abatimentos numeric DEFAULT 0, -- total dos abatimentos
  ADD COLUMN descricao_abatimentos text,  -- ex: "Taxa cartão 3% + ISS 5%"
  ADD COLUMN valor_liquido numeric;       -- valor efetivo a pagar/receber
```

> O campo `valor` existente continuará sendo usado como `valor_liquido` para compatibilidade. Os novos campos são opcionais (nullable).

**Atualizar a função `sync_parceiro_pagamento_to_financeiro`** para:
- Usar `valor_liquido` (ou `valor` caso não haja abatimentos) na criação do lançamento
- Ao marcar como pago, atualizar `data_pagamento` e `status = 'pago'` no lançamento financeiro vinculado

**Criar trigger de sincronização reversa** (`sync_financeiro_to_parceiro_pagamento`): quando `fin_lancamentos` for atualizado com `status = 'pago'` e existir um `parceiros_pagamentos` com `lancamento_financeiro_id` correspondente, atualiza automaticamente o status e data de pagamento no parceiro.

---

### Mudanças na UI

#### 1. `PagamentoParceiroDialog.tsx` — Dialog de criação

**Adicionar seção de abatimentos:**
- Campo "Valor Bruto (R$)" — valor total antes dos abatimentos
- Campo "Abatimentos (R$)" — valor a descontar (taxa de cartão, imposto, etc.)
- Campo "Descrição dos Abatimentos" — texto livre (ex: "Taxa cartão 3% + ISS")
- **Preview automático** do "Valor Líquido" = Bruto - Abatimentos
- Campo "Pagar 1ª parcela agora?" — checkbox para marcar a 1ª parcela como paga no ato do lançamento

**Parcelas individualizadas (quando > 1 parcela):**
- Ao invés de dividir igualmente e bloquear, mostrar uma tabela de parcelas editáveis
- Cada parcela terá: data de vencimento editável + valor editável + campo de abatimento por parcela
- O valor padrão será dividido igualmente, mas o usuário pode ajustar cada linha

```
Parcela | Vencimento     | Valor Bruto | Abatimento | Valor Líquido | Pagar agora?
  1/3   | 20/02/2026     | R$ 1.000    | R$ 50      | R$ 950        | [✓]
  2/3   | 20/03/2026     | R$ 1.000    | -          | R$ 1.000      | [ ]
  3/3   | 20/04/2026     | R$ 1.000    | -          | R$ 1.000      | [ ]
```

#### 2. `ParceiroDetalhes.tsx` — Aba de Pagamentos

**Adicionar coluna "Valor Líquido"** na tabela de pagamentos (quando houver abatimentos).

**Adicionar coluna "Ações"** com:
- Botão **"Marcar como Pago"** para parcelas pendentes → abre mini-dialog confirmando a data de pagamento
- Badge de status visual melhorado: "Pendente" / "Pago" / "Vencido" (vermelho se data_vencimento < hoje e status != 'pago')
- Botão **"Editar"** para parcelas pendentes → permite editar valor e abatimentos da parcela

**Mini-dialog de confirmação de pagamento:**
- Mostra: parcela X/Y, valor líquido, parceiro
- Campo: data do pagamento (default = hoje)
- Botão confirmar → atualiza `status = 'pago'`, `data_pagamento`, e sincroniza com o financeiro

---

### Fluxo de Sincronização Bidirecional

```
PARCEIROS → FINANCEIRO
Ao marcar parcela como paga no módulo de parceiros:
  1. UPDATE parceiros_pagamentos SET status='pago', data_pagamento=X
  2. Trigger/função verifica se tem lancamento_financeiro_id
     - Se SIM → UPDATE fin_lancamentos SET status='pago', data_pagamento=X
     - Se NÃO → INSERT em fin_lancamentos e vincula o id

FINANCEIRO → PARCEIROS
Ao pagar lançamento no financeiro (trigger existente aprimorado):
  1. fin_lancamentos UPDATE com status='pago'
  2. Novo trigger verifica se existe parceiros_pagamentos com lancamento_financeiro_id = lançamento.id
     - Se SIM → UPDATE parceiros_pagamentos SET status='pago', data_pagamento=X
```

---

### Arquivos a Criar/Modificar

| Arquivo | Tipo | Mudança |
|---|---|---|
| Migração SQL | Novo | Adicionar colunas `valor_bruto`, `valor_abatimentos`, `descricao_abatimentos`, `valor_liquido` à `parceiros_pagamentos`; atualizar trigger de sincronização; criar trigger reverso financeiro→parceiros |
| `src/components/parceiros/PagamentoParceiroDialog.tsx` | Modificar | Adicionar campos de abatimento, tabela de parcelas editáveis, opção de pagar no ato |
| `src/components/parceiros/ParceiroDetalhes.tsx` | Modificar | Adicionar colunas, botões de ação (marcar pago/editar), badge "Vencido", mini-dialog de confirmação de pagamento |
| `src/components/parceiros/EditarParcelaDialog.tsx` | Novo | Dialog para editar valor/abatimentos de uma parcela pendente |

---

### Resultado Esperado

- Ao criar um pagamento, Rafael poderá informar o valor bruto + abatimentos → o sistema calcula e exibe o líquido
- Para pagamentos parcelados, cada parcela terá seu próprio valor e abatimento editável
- Na aba de Pagamentos do parceiro, cada parcela pendente terá botão "Marcar como Pago" que sincroniza automaticamente com o financeiro
- Se o pagamento for registrado no financeiro, a parcela do parceiro atualiza automaticamente para "Pago"
