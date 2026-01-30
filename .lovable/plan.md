
# Plano: Correção da Sincronização ADVBox e Implementação de Rateio em Pagamentos

## Resumo dos Problemas Identificados

### 1. Dados Financeiros Incorretos do ADVBox
**Problema Crítico**: A sincronização está classificando TODAS as transações como "despesa" quando deveriam ser classificadas corretamente como "receita" ou "despesa" baseado na categoria do ADVBox.

**Causa Raiz Descoberta**:
- O ADVBox usa o campo `debit_bank` para TODAS as transações (tanto receitas quanto despesas)
- O campo `credit_bank` está sempre nulo nos dados analisados
- A lógica atual no código tenta determinar o tipo baseado apenas no valor (positivo/negativo), mas todos os valores são positivos
- A classificação correta deve ser feita baseada no **nome da categoria** do ADVBox:
  - **RECEITAS**: Categorias que contêm "HONORÁRIOS", "RECEITA", "REEMBOLSO DE CUSTO POR CLIENTES"
  - **DESPESAS**: Categorias que contêm "GASTOS", "CUSTAS", "TAXAS", "REPASSES", "INVESTIMENTOS"

**Evidência**: Analisando os dados no banco:
- Categoria "HONORÁRIOS INICIAIS" com debit_bank "BANCO ITAÚ" = **RECEITA** (168 registros, R$ 353.182,13)
- Categoria "REPASSES" com debit_bank "BANCO ITAÚ" = **DESPESA** (101 registros, R$ 2.059.251,73)

**Dados Atuais (Janeiro/2026)**: Apenas 17 registros importados com status "pago":
- 14 receitas = R$ 38.245,22
- 2 despesas = R$ 51,87

**Realidade Esperada**: Centenas de registros no mês atual, com valores muito maiores

### 2. Rateio em Pagamentos de Colaboradores
**Status Atual**: O componente `RHPagamentos.tsx` JÁ TEM a funcionalidade de rateio implementada (linhas 378-415 e 804-920):
- Campo "Descrição do Pagamento" ✅
- Toggle "Usar Rateio?" ✅
- Interface para adicionar múltiplas categorias ✅

**Verificação Necessária**: A funcionalidade está presente, mas preciso verificar se está funcionando corretamente na prática.

### 3. Saldo do Asaas Zerado nos Relatórios
**Status**: O `FinanceiroDashboard.tsx` já implementa a busca do saldo do Asaas (linhas 118-185), porém pode haver falha na identificação da conta.

---

## Plano de Implementação

### Etapa 1: Corrigir Classificação de Receita/Despesa no ADVBox Sync

**Arquivo**: `supabase/functions/sync-advbox-financial/index.ts`

**Mudanças**:
1. Refatorar a função `processTransactionsBatch` para classificar transações corretamente baseado na categoria:

```text
CATEGORIAS DE RECEITA (contêm):
- "HONORÁRIOS" (INICIAIS, FINAIS, SUCUMBÊNCIA, CONSULTORIAS, etc.)
- "RECEITA OPERACIONAL"
- "REEMBOLSO DE CUSTO POR CLIENTES"

CATEGORIAS DE DESPESA (contêm):
- "GASTOS" (COM CLIENTES, COM ESCRITÓRIO, etc.)
- "CUSTAS"
- "TAXAS"
- "REPASSES"
- "INVESTIMENTOS"
- "GUIA DE CUSTAS PAGAS"
```

2. Remover a lógica atual que baseia o tipo no sinal do valor (todas são positivas)

### Etapa 2: Reprocessar Sincronização

**Ações**:
1. Limpar os registros existentes com origem "advbox" (já implementado via SQL)
2. Resetar o status da sincronização
3. Reprocessar todos os dados com a nova lógica de classificação

### Etapa 3: Verificar e Corrigir Saldo do Asaas

**Arquivo**: `src/components/financeiro/FinanceiroExecutivoDashboard.tsx`

**Ação**: Garantir que a conta Asaas seja identificada corretamente e o saldo seja atualizado via API em tempo real.

### Etapa 4: Validar Rateio em RHPagamentos

**Verificação**: O código já existe mas precisa confirmar que:
- A categoria é associada corretamente ao lançamento financeiro
- Múltiplos lançamentos são criados quando rateio está habilitado

---

## Detalhes Técnicos

### Modificação Principal: sync-advbox-financial/index.ts

A função `processTransactionsBatch` será modificada da seguinte forma:

```typescript
// Nova função para determinar tipo baseado na categoria
function determineTransactionType(category: string): 'receita' | 'despesa' {
  const categoryLower = category.toLowerCase();
  
  // Padrões de RECEITA
  const revenuePatterns = [
    'honorários',
    'honorarios',
    'receita operacional',
    'receita',
    'reembolso de custo por clientes'
  ];
  
  // Padrões de DESPESA
  const expensePatterns = [
    'gastos',
    'custas',
    'taxas',
    'repasses',
    'investimentos',
    'guia de custas pagas',
    'despesas'
  ];
  
  for (const pattern of revenuePatterns) {
    if (categoryLower.includes(pattern)) return 'receita';
  }
  
  for (const pattern of expensePatterns) {
    if (categoryLower.includes(pattern)) return 'despesa';
  }
  
  // Fallback: se não identificar, assumir despesa (mais conservador)
  return 'despesa';
}
```

### Resultado Esperado

Após as correções:
- Janeiro/2026 mostrará centenas de registros de receita (honorários de clientes)
- As despesas refletirão corretamente gastos, custas, taxas e repasses
- A margem de lucro será calculada corretamente
- O saldo do Asaas será exibido em tempo real nos relatórios

### Arquivos a Modificar

1. `supabase/functions/sync-advbox-financial/index.ts` - Lógica de classificação
2. Migration SQL para limpar e reprocessar dados
3. Verificação do `FinanceiroExecutivoDashboard.tsx` para saldo Asaas
