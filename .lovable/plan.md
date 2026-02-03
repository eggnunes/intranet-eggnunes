
# Plano: Correção da Tela em Branco no Perfil do Colaborador + Auditoria Completa

## Problema Principal Identificado

O perfil do colaborador (Daniel) fica em branco porque há um **erro de banco de dados não tratado**:

```
column vacation_requests.days_requested does not exist
```

Este erro ocorre no `ColaboradorPerfilUnificado.tsx` na linha 152 e faz com que a promise seja rejeitada sem tratamento adequado, resultando em tela em branco.

---

## Causa Raiz Detalhada

### 1. Coluna Inexistente na Query de Férias

**Arquivo:** `src/components/rh/ColaboradorPerfilUnificado.tsx`
**Linhas:** 150-155, 207

```typescript
// CÓDIGO BUGADO - coluna days_requested NÃO EXISTE!
supabase
  .from('vacation_requests')
  .select('id, start_date, end_date, status, days_requested')  // ERRO!
  .eq('user_id', colaboradorId)
```

**Colunas reais da tabela `vacation_requests`:**
- id, user_id, start_date, end_date
- **business_days** (esta é a coluna correta!)
- status, approved_by, approved_at, rejection_reason
- notes, created_at, updated_at
- acquisition_period_start, acquisition_period_end, sold_days

### 2. Referência Duplicada à Coluna Inexistente

Na linha 207, o código tenta acessar `f.days_requested`:
```typescript
dias_totais: f.days_requested  // ERRO! Deve ser f.business_days
```

---

## Outros Problemas Identificados

### 3. Bugs de Timezone Ainda Presentes

O `ColaboradorPerfilUnificado.tsx` não foi atualizado para usar o `dateUtils.ts`, ainda usando `format(new Date(...))`:

| Linha | Código Bugado | Problema |
|-------|---------------|----------|
| 193 | `format(new Date(p.mes_referencia), 'MMM/yy')` | Mês pode aparecer errado |
| 248 | `format(new Date(dueDate), 'MMM/yy')` | Data ADVBOX pode aparecer errada |
| 408 | `format(parse(promocoes[0].data_promocao, ...))` | OK - usa parse corretamente |
| 594 | `format(new Date(p.mes_referencia), 'MMMM/yyyy')` | Tabela de pagamentos |
| 598 | `format(new Date(p.data_pagamento), 'dd/MM/yyyy')` | Data de pagamento |
| 718 | `format(new Date(f.data_inicio), 'dd/MM/yy')` | Datas de férias |
| 762 | `format(new Date(h.data_alteracao), 'dd/MM/yyyy')` | Histórico de salário |

### 4. Bugs de Timezone no RHAdiantamentos

**Arquivo:** `src/components/rh/RHAdiantamentos.tsx`

| Linha | Código Bugado |
|-------|---------------|
| 557 | `format(new Date(adiantamento.data_adiantamento), 'dd/MM/yyyy')` |
| 627 | `format(new Date(desconto.mes_referencia + '-01'), 'MMM/yyyy')` |
| 632 | `format(new Date(desconto.data_desconto), 'dd/MM/yyyy')` |

### 5. Bugs de Timezone no RHPagamentos (PDF)

**Arquivo:** `src/components/rh/RHPagamentos.tsx`

| Linha | Código Bugado |
|-------|---------------|
| 674 | `format(new Date(pagamento.mes_referencia), 'MMMM/yyyy')` |
| 679 | `format(new Date(pagamento.data_pagamento), 'dd/MM/yyyy')` |
| 750 | `format(new Date(pagamento.mes_referencia), 'MM_yyyy')` |

### 6. Bugs de Timezone no RHDashboard

**Arquivo:** `src/components/rh/RHDashboard.tsx`

| Linha | Código Bugado |
|-------|---------------|
| 79 | `startOfMonth(new Date(periodoInicio + '-01'))` |
| 80 | `endOfMonth(new Date(periodoFim + '-01'))` |

---

## Correções Necessárias

### Prioridade 1: Corrigir Erro Crítico (Tela em Branco)

**Arquivo:** `src/components/rh/ColaboradorPerfilUnificado.tsx`

**Correção 1 - Linha 152:**
```typescript
// ANTES:
.select('id, start_date, end_date, status, days_requested')

// DEPOIS:
.select('id, start_date, end_date, status, business_days')
```

**Correção 2 - Linha 207:**
```typescript
// ANTES:
dias_totais: f.days_requested

// DEPOIS:
dias_totais: f.business_days
```

### Prioridade 2: Adicionar Import do dateUtils

```typescript
import { formatMesReferencia, formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
```

### Prioridade 3: Corrigir Todas as Formatações de Data

Substituir todas as ocorrências de `format(new Date(...))` por funções do `dateUtils.ts`:

- `formatMesReferencia()` - para mês/ano
- `formatLocalDate()` - para dd/MM/yyyy

### Prioridade 4: Aplicar Mesma Correção em Outros Arquivos RH

- `RHAdiantamentos.tsx`
- `RHPagamentos.tsx` (especialmente na geração de PDF)
- `RHDashboard.tsx`

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/rh/ColaboradorPerfilUnificado.tsx` | Corrigir query de férias + imports + formatação de datas |
| `src/components/rh/RHAdiantamentos.tsx` | Adicionar imports + corrigir formatação de datas |
| `src/components/rh/RHPagamentos.tsx` | Corrigir formatação no PDF |
| `src/components/rh/RHDashboard.tsx` | Corrigir criação de datas para filtros |

---

## Resumo de Implementação

| Prioridade | Ação | Impacto |
|------------|------|---------|
| **Crítica** | Corrigir `days_requested` para `business_days` | Resolve tela em branco |
| **Alta** | Adicionar import do `dateUtils` | Prepara correções de timezone |
| **Alta** | Corrigir `format(new Date(...))` no ColaboradorPerfilUnificado | Datas corretas no perfil |
| **Média** | Corrigir outros arquivos RH | Consistência em todo módulo |
| **Baixa** | Melhorar tratamento de erros | Evita telas em branco futuras |

---

## Seção Técnica

### Por que a tela fica em branco?

1. O `ColaboradorPerfilUnificado` usa `Promise.all()` para buscar dados em paralelo
2. Uma das queries referencia uma coluna inexistente (`days_requested`)
3. O Supabase retorna um erro
4. O erro é capturado pelo `catch`, mas o componente já iniciou a renderização
5. Como a estrutura de dados não está completa, a UI quebra silenciosamente

### Solução de Tratamento de Erro Robusto

Além de corrigir a coluna, adicionar verificação defensiva:

```typescript
if (!feriasRes.error && feriasRes.data) {
  const feriasData = feriasRes.data.map((f: any) => ({
    id: f.id,
    data_inicio: f.start_date,
    data_fim: f.end_date,
    status: f.status,
    dias_totais: f.business_days || 0  // Fallback para 0 se não existir
  }));
  setFerias(feriasData);
}
```

### Verificação de Datas no Dashboard RH

O código atual:
```typescript
const startDate = startOfMonth(new Date(periodoInicio + '-01'));
```

Deveria usar o parseLocalDate:
```typescript
const startDate = startOfMonth(parseLocalDate(periodoInicio + '-01'));
```

---

## Validação Pós-Implementação

1. O perfil do Daniel abre corretamente
2. Os dados de férias aparecem na aba "Carreira"
3. Os meses de referência aparecem corretamente (sem shift de timezone)
4. O gráfico de evolução de pagamentos mostra meses corretos
5. A tabela de pagamentos no perfil mostra datas corretas
6. O PDF de recibo gera com datas corretas
7. O dashboard RH filtra corretamente por período
