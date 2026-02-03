
# Plano: Correção Completa de Timezone + Auditoria Geral da Intranet

## Problema Identificado

O bug **NÃO foi corrigido** porque a correção anterior só tratou a **inicialização do modal de edição** (linha 790), mas **NÃO corrigiu a exibição na tabela** (linha 1221).

### Evidência do Bug

**Dados no banco de dados:**
```
mes_referencia: 2026-01-01 (Janeiro 2026)
```

**Exibição na tela:**
```
dez/2025 (Dezembro 2025)
```

### Causa Raiz Completa

Na linha 1221 do `RHPagamentos.tsx`:
```typescript
{format(new Date(pag.mes_referencia), 'MMM/yyyy', { locale: ptBR })}
```

O JavaScript interpreta `2026-01-01` como meia-noite UTC. No horário de Brasília (UTC-3), isso se torna `31/12/2025 às 21:00`, resultando em "dez/2025" na formatação.

---

## Correções Necessárias

### 1. Corrigir Exibição do Mês na Tabela de Pagamentos

**Arquivo:** `src/components/rh/RHPagamentos.tsx`
**Linha:** 1221

**Código atual (bugado):**
```typescript
{format(new Date(pag.mes_referencia), 'MMM/yyyy', { locale: ptBR })}
```

**Código corrigido:**
```typescript
{(() => {
  const [year, month] = pag.mes_referencia.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1, 12, 0, 0);
  return format(date, 'MMM/yyyy', { locale: ptBR });
})()}
```

**Alternativa mais limpa:** Criar uma função helper:
```typescript
const formatMesReferencia = (dateStr: string) => {
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1, 12, 0, 0);
  return format(date, 'MMM/yyyy', { locale: ptBR });
};
```

### 2. Aplicar Correção Similar em Profile.tsx

**Arquivo:** `src/pages/Profile.tsx`
**Linhas afetadas:** 415, 1006, 1763

O mesmo bug existe na página de perfil do colaborador, que também exibe `mes_referencia`.

### 3. Criar Helper Centralizado para Datas

Para evitar repetição e garantir consistência, criar uma função utilitária:

**Arquivo:** `src/lib/dateUtils.ts` (novo)
```typescript
// Converte string YYYY-MM-DD para Date local sem shift de timezone
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day || 1, 12, 0, 0);
}

// Formata mes_referencia sem bug de timezone
export function formatMesReferencia(dateStr: string, formatStr = 'MMM/yyyy'): string {
  const date = parseLocalDate(dateStr);
  return format(date, formatStr, { locale: ptBR });
}
```

---

## Auditoria Geral do Sistema Financeiro

Vou verificar todos os componentes críticos para garantir integridade:

### Componentes Verificados

| Componente | Status | Problema Encontrado |
|------------|--------|---------------------|
| `RHPagamentos.tsx` | Bug Crítico | Exibição de mes_referencia com timezone shift |
| `Profile.tsx` | Bug Crítico | Mesmo problema na exibição de pagamentos |
| `FinanceiroLancamentos.tsx` | OK | Usa `data_lancamento` diretamente como string |
| `EditarLancamentoDialog.tsx` | OK | Inicializa datas diretamente das strings |
| `NovoLancamentoDialog.tsx` | OK | Usa `toISOString().split('T')[0]` para datas locais |
| `FinanceiroFluxoCaixa.tsx` | Atenção | Usa `new Date(data)` na linha 139 (risco menor) |
| `FinanceiroRecorrencias.tsx` | Atenção | Usa `new Date(dataInicio)` em cálculos |
| `FinanceiroConciliacao.tsx` | A verificar |
| `FinanceiroAprovacoes.tsx` | A verificar |

### Pontos de Risco Identificados

1. **Arquivos com mais de 1000 ocorrências de `format(new Date(...))` (73 arquivos)**
   - Muitos desses são para timestamps completos (com hora), onde o problema é menor
   - O risco maior está em datas de calendário (YYYY-MM-DD) usadas para referência de mês

2. **Sincronização ADVBox**
   - Verificar se as datas financeiras importadas do ADVBox estão sendo tratadas corretamente
   - A lógica atual usa strings diretamente, o que é seguro

3. **Triggers de Auditoria**
   - Os triggers de auditoria (`audit_log`) funcionam no lado do banco, não são afetados por timezone do JavaScript

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/dateUtils.ts` | **CRIAR** - Funções utilitárias de data |
| `src/components/rh/RHPagamentos.tsx` | Linha 1221 - Corrigir exibição do mês |
| `src/pages/Profile.tsx` | Linhas 415, 1006, 1763 - Corrigir exibição |
| `src/components/financeiro/FinanceiroFluxoCaixa.tsx` | Linha 139 - Verificar e corrigir se necessário |

---

## Seção Técnica

### Detalhes do Bug de Timezone

O JavaScript possui um comportamento inconsistente ao interpretar strings de data:

```javascript
// String YYYY-MM-DD é interpretada como UTC
new Date('2026-01-01')
// Result: Wed Jan 01 2026 00:00:00 GMT+0000 (UTC)
// Em Brasília (UTC-3): Tue Dec 31 2025 21:00:00 GMT-0300

// Construtor com componentes é interpretado como local
new Date(2026, 0, 1)  // Month is 0-indexed
// Result: Wed Jan 01 2026 00:00:00 GMT-0300 (horário local)
```

### Solução Correta

Ao trabalhar com datas de calendário (sem horário), sempre:

1. **Parse manual:** Extrair ano, mês, dia da string e criar Date com o construtor de componentes
2. **Fixar hora ao meio-dia:** `new Date(year, month - 1, day, 12, 0, 0)` para evitar problemas de DST
3. **Ou tratar como string:** Quando possível, usar `substring(0, 7)` para extrair `YYYY-MM`

### Padrão Recomendado

```typescript
// ERRADO - causa shift de timezone
const date = new Date('2026-01-01');

// CORRETO - cria data local
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day || 1, 12, 0, 0);
}
```

---

## Resumo de Implementação

| Prioridade | Ação | Arquivo |
|------------|------|---------|
| **Crítica** | Corrigir exibição de mês na tabela | RHPagamentos.tsx (linha 1221) |
| **Crítica** | Corrigir exibição de mês no perfil | Profile.tsx (linhas 415, 1006, 1763) |
| **Alta** | Criar helper centralizado | src/lib/dateUtils.ts (novo arquivo) |
| **Média** | Verificar fluxo de caixa | FinanceiroFluxoCaixa.tsx |
| **Média** | Verificar recorrências | FinanceiroRecorrencias.tsx |
| **Baixa** | Auditoria completa dos 73 arquivos | Todos os componentes com format(new Date()) |

---

## Validação Pós-Implementação

Após as correções, verificar:

1. O pagamento do Daniel aparece como **jan/2026** na lista
2. O modal de edição mostra **janeiro de 2026**
3. A página de perfil do colaborador exibe os meses corretamente
4. Os filtros de período funcionam corretamente
5. Dados do ADVBox sincronizados estão sendo exibidos com datas corretas
