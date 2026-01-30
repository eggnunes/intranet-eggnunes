
# Plano: Correção da Sincronização ADVBox e Verificação do Saldo Asaas

## Status: ✅ IMPLEMENTADO

## Mudanças Realizadas

### 1. ✅ Correção da Classificação de Receita/Despesa no ADVBox Sync

**Arquivo**: `supabase/functions/sync-advbox-financial/index.ts`

**Problema Resolvido**: A sincronização estava classificando TODAS as transações como "despesa" porque:
- O ADVBox usa `debit_bank` para TODAS as transações
- A lógica anterior baseava o tipo no sinal do valor (todos são positivos)

**Solução Implementada**: Nova função `determineTransactionType()` que classifica baseado no **nome da categoria**:

```typescript
CATEGORIAS DE RECEITA:
- honorários (iniciais, finais, sucumbência, consultorias, extrajudiciais)
- receita operacional
- receita
- reembolso de custo por clientes

CATEGORIAS DE DESPESA:
- gastos (com clientes, com escritório)
- custas (processuais, judiciais)
- taxas (processuais, judiciais)
- repasses (a terceiros)
- investimentos
- guia de custas pagas
- despesas operacionais
- pagamentos
- adiantamentos
```

### 2. ✅ Limpeza e Reset da Sincronização

**Migration executada** para:
- Desabilitar temporariamente trigger de auditoria
- Limpar tabela `advbox_financial_sync` 
- Limpar registros ADVBox de `fin_lancamentos`
- Resetar `advbox_sync_status` para status `idle`
- Reabilitar trigger de auditoria

### 3. ✅ Verificação do Saldo Asaas

**Status**: O código já está implementado corretamente em:
- `FinanceiroDashboard.tsx` (linhas 118-185)
- `FinanceiroExecutivoDashboard.tsx` (linhas 283-350)

**Lógica**:
1. Busca saldo via `supabase.functions.invoke('asaas-integration')`
2. Fallback com fetch direto usando anon key
3. Atualiza a conta Asaas na lista `contasSaldo`
4. Adiciona conta virtual se não encontrar mas tiver saldo

---

## Próximos Passos

1. **Iniciar nova sincronização**: Vá para Financeiro > Sincronização ADVBox e clique "Iniciar Sincronização"
2. Os dados serão importados com a classificação correta de receita/despesa
3. O dashboard mostrará valores corretos de receitas vs despesas
4. A margem de lucro será calculada corretamente

## Funcionalidades Existentes Confirmadas

### Rateio em Pagamentos de Colaboradores
O componente `RHPagamentos.tsx` já possui:
- ✅ Campo "Descrição do Pagamento" 
- ✅ Toggle "Usar Rateio?"
- ✅ Interface para adicionar múltiplas categorias
- ✅ Criação de múltiplos lançamentos financeiros por categoria

### Rateio em Novo Lançamento Financeiro
O componente `NovoLancamentoDialog.tsx` já possui:
- ✅ Opção de escolher entre Parcelamento ou Rateio
- ✅ Componente `RateioLancamentoDialog` integrado
