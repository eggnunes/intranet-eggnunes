

## Nova sub-aba "Comissão dos Vendedores" no CRM

### O que será feito
1. Criar tabela `crm_commission_rules` para armazenar as faixas de comissionamento (editável por admins)
2. Criar componente `CRMCommissions.tsx` com dashboard de comissões e painel de configuração de regras
3. Adicionar sub-aba "Comissões" no CRM Dashboard

### 1. Migração SQL — Tabela de regras de comissão

```sql
CREATE TABLE crm_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts INTEGER NOT NULL,
  max_contracts INTEGER, -- NULL = sem limite (faixa aberta)
  value_per_contract NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Inserir as 3 faixas padrão (1-29 = R$75, 30-44 = R$100, 45+ = R$125). RLS: leitura para autenticados aprovados, escrita apenas para admins/sócios.

### 2. Componente `CRMCommissions.tsx`

- Reutiliza a lógica de `getBusinessCyclePeriod()` (ciclo 25-24) e `EXCLUDED_NAMES` do Ranking
- Busca deals `won=true` no período com `closed_at` filtrado, agrupando por `owner_id`
- Busca as regras de comissão da tabela `crm_commission_rules`
- Calcula:
  - **Total de contratos da equipe** (soma de todos os vendedores)
  - **Faixa vigente** com base no total da equipe
  - **Comissão individual** = contratos do vendedor × valor da faixa vigente

**Interface:**
- Card superior com: total de contratos da equipe, faixa atual, valor por contrato
- Tabela/lista de vendedores com: nome, contratos fechados, valor da comissão (R$)
- Barra de progresso mostrando proximidade da próxima faixa
- Seção "Configurar Regras" (visível apenas para admins) com formulário para editar as 3 faixas

### 3. Integração no `CRMDashboard.tsx`

- Importar `CRMCommissions`
- Adicionar `TabsTrigger` com ícone `Wallet` e label "Comissões"
- Adicionar `TabsContent` correspondente
- Atualizar export em `index.ts`

### Arquivos modificados
- **Migração SQL** — tabela `crm_commission_rules` + seed das 3 faixas
- **`src/components/crm/CRMCommissions.tsx`** — novo componente
- **`src/components/crm/CRMDashboard.tsx`** — nova aba
- **`src/components/crm/index.ts`** — export

