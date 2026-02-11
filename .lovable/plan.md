

## Plano: Corrigir Dashboard Executivo Financeiro

### Problemas Identificados

Após análise detalhada do banco de dados e do código, identifiquei as seguintes causas raiz:

---

### Problema 1: Saldo por Conta mostrando valores irreais

**Causa**: Todas as 4 contas (Investimentos, Asaas, Caixa Local, Banco Itaú) têm `saldo_inicial = R$ 0,00`. O sistema possui um trigger que recalcula `saldo_atual = saldo_inicial + SUM(lançamentos)`, porém **99,8% dos lançamentos** (15.226 de 15.260) vindos do ADVBox **não têm conta associada** (`conta_origem_id = NULL`). Apenas ~34 lançamentos manuais estão vinculados a contas, gerando saldos errados como Banco Itaú -R$ 98.303,83.

Conforme a regra de negócio já documentada: *"Saldos de contas bancárias não são calculados automaticamente pela sincronização do ADVBox. O saldo deve vir de extratos bancários carregados pelo usuário."*

**Solução**: No Dashboard Executivo, mostrar o saldo da conta **somente** quando o usuário configurou o saldo inicial (`saldo_inicial != 0`) OU quando a conta tem conciliação bancária feita. Contas sem configuração exibirão "Saldo não configurado" ao invés de valores calculados incorretamente. A exceção é a conta Asaas, que busca o saldo em tempo real via API.

---

### Problema 2: Evolução Financeira mostrando prejuízo de R$ 595.000 em dezembro

**Causa**: TODOS os 432 lançamentos de dezembro/2025 vieram da sincronização do ADVBox. As despesas totalizam R$ 798.775, mas isso inclui:
- **R$ 492.597 em "REPASSE"** (valores repassados a clientes -- dinheiro que apenas transita pelo escritório)
- **R$ 90.000 em "DISTRIBUIÇÃO DE LUCRO"** (não é despesa operacional)
- **R$ 46.013 em "HONORÁRIOS sócios"** (retirada, não despesa operacional)

Esses lançamentos de repasse e distribuição de lucros inflam artificialmente as despesas, fazendo parecer que houve prejuízo quando na realidade houve lucro operacional.

**Solução**: Criar filtro inteligente no gráfico de Evolução Financeira que exclui por padrão lançamentos de "REPASSE", "DISTRIBUIÇÃO DE LUCRO" e "HONORÁRIOS [sócio]" do cálculo de despesas. Adicionar um toggle visível para o usuário poder incluir/excluir essas categorias. Isso mostrará o resultado operacional real do escritório.

---

### Alterações Técnicas

**Arquivo: `src/components/financeiro/FinanceiroExecutivoDashboard.tsx`**

1. **Saldo por Conta (linhas 200-205 e 640-665)**:
   - Modificar a lógica de `contasSaldo` para verificar se `saldo_inicial != 0` antes de exibir o valor
   - Para contas com `saldo_inicial = 0` e sem conciliação, mostrar "Não configurado" com um ícone informativo
   - Manter a lógica especial da conta Asaas (saldo via API)
   - Recalcular "Saldo Total em Caixa" usando apenas contas com saldo configurado

2. **Evolução Financeira (linhas 234-268 e 612-638)**:
   - Adicionar um estado `excluirRepasses` (padrão: `true`)
   - Na query de evolução mensal, filtrar lançamentos cujo `descricao` contenha "REPASSE", "DISTRIBUIÇÃO DE LUCRO" quando o toggle estiver ativo
   - Adicionar um Switch/Toggle acima do gráfico: "Excluir repasses e distribuições"
   - Aplicar o mesmo filtro nos cards de Receitas/Despesas/Lucro para consistência

3. **Cards principais (linhas 132-156)**:
   - Aplicar o mesmo filtro de exclusão de repasses na query principal de lançamentos do período
   - Garantir que os valores dos cards sejam consistentes com o gráfico

---

### Resumo do Impacto

| Elemento | Antes | Depois |
|----------|-------|--------|
| Saldo Banco Itaú | -R$ 98.303,83 (errado) | "Não configurado" |
| Saldo Caixa Local | -R$ 26.559,11 (errado) | "Não configurado" |
| Saldo Investimentos | -R$ 17.385,02 (errado) | "Não configurado" |
| Saldo Asaas | R$ 34.655,50 (correto via API) | R$ 34.655,50 (mantido) |
| Despesas Dez/25 | R$ 798.775 (inflado) | ~R$ 170.164 (operacional real) |
| Lucro Dez/25 | -R$ 595.063 (prejuízo falso) | ~R$ 33.547 (lucro real) |

