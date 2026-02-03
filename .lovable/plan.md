
# Plano: Corrigir Edição de Mês de Referência em Pagamentos + Auditoria do Financeiro

## Problema Identificado

O mês de referência não está sendo alterado corretamente porque há um **bug de timezone** na conversão de datas.

### Causa Raiz
Quando você tenta editar um pagamento:
1. O sistema lê a data `2025-12-01` do banco
2. Converte para objeto `Date` usando `new Date(pagamento.mes_referencia)`
3. Dependendo do timezone do navegador, `2025-12-01 00:00 UTC` pode virar `30/11/2025 21:00` no horário de Brasília
4. O `format()` então exibe `2025-11` em vez de `2025-12`
5. Mesmo alterando para `2025-01`, a data exibida estava errada desde o início

### Status Atual do Pagamento do Daniel
Verificação no banco de dados mostra:
- **mes_referencia**: `2026-01-01` (Janeiro 2026)
- **data_pagamento**: `2026-01-30`
- **status**: processado

O pagamento já está em janeiro de 2026, mas o filtro atual pode estar mostrando outro mês.

---

## Correções Necessárias

### 1. Corrigir Bug de Timezone no RHPagamentos

**Arquivo**: `src/components/rh/RHPagamentos.tsx`

**Alteração na inicialização do campo de edição (linha 788):**
```typescript
// ANTES (bugado):
setEditMesReferencia(format(new Date(pagamento.mes_referencia), 'yyyy-MM'));

// DEPOIS (corrigido):
setEditMesReferencia(pagamento.mes_referencia.substring(0, 7));
```

Isso extrai diretamente os primeiros 7 caracteres da string (`2026-01`), evitando qualquer conversão de timezone.

### 2. Corrigir Conversão na Busca de Pagamentos

Mesma lógica para evitar problemas ao exibir os pagamentos na tabela - garantir que as datas sejam tratadas como strings quando possível.

### 3. Adicionar Log de Depuração Temporário

Para garantir que as alterações estão sendo enviadas corretamente ao banco.

---

## Verificação Geral do Módulo Financeiro

Como solicitado, vou criar uma tarefa para revisar todo o sistema financeiro.

### Componentes a Verificar:
1. **RHPagamentos.tsx** - Edição de pagamentos (problema atual)
2. **FinanceiroLancamentos.tsx** - Listagem e edição de lançamentos
3. **EditarLancamentoDialog.tsx** - Modal de edição de lançamentos
4. **NovoLancamentoDialog.tsx** - Criação de novos lançamentos
5. **FinanceiroFluxoCaixa.tsx** - Fluxo de caixa
6. **FinanceiroRecorrencias.tsx** - Lançamentos recorrentes
7. **FinanceiroAprovacoes.tsx** - Aprovações pendentes
8. **FinanceiroConciliacao.tsx** - Conciliação bancária
9. **Triggers de Auditoria** - Verificar se estão funcionando

### Pontos de Verificação:
- Conversão de datas (timezone issues)
- Filtros de período
- Salvamento de dados
- Integridade de dados entre RH e Financeiro (trigger de sincronização)
- Policies de RLS para visualização/edição

---

## Resumo de Implementação

| Prioridade | Ação | Arquivo |
|------------|------|---------|
| Alta | Corrigir bug de timezone na edição | RHPagamentos.tsx |
| Alta | Verificar se filtro de mês está correto | RHPagamentos.tsx |
| Média | Revisar outros componentes com datas | Módulo financeiro |
| Baixa | Adicionar validações extras | Geral |

---

## Seção Técnica

### Detalhes do Bug de Timezone

O JavaScript interpreta datas no formato `YYYY-MM-DD` como UTC:
```javascript
new Date('2025-12-01') 
// Resultado: Mon Dec 01 2025 00:00:00 GMT+0000 (UTC)
// No horário de Brasília (UTC-3): Sun Nov 30 2025 21:00:00
```

Isso causa o "dia anterior" em países com timezone negativo (como o Brasil).

### Solução Implementada
Extrair substring diretamente, sem passar pela conversão `Date`:
```javascript
'2025-12-01'.substring(0, 7) // '2025-12' - sempre correto
```

### Arquivos Modificados
1. `src/components/rh/RHPagamentos.tsx`
   - Linha 788: Corrigir inicialização de `editMesReferencia`
