
# Plano de Correção: Sistema de Parceiros

## 1. Problema Identificado: Erro ao Salvar Parceiro

**Causa Raiz**: As politicas de segurança (RLS) da tabela `parceiros` apenas permitem que **administradores** criem, editem ou excluam parceiros. Usuarios comuns so podem visualizar.

Politica atual:
- SELECT: Usuarios aprovados podem ver
- ALL (INSERT/UPDATE/DELETE): Somente admins

**Solucao**: Criar uma nova politica RLS que permita que qualquer usuario aprovado possa criar parceiros (INSERT), mantendo as restricoes de UPDATE/DELETE apenas para admins e comercial.

---

## 2. Mascara no Telefone

**Situacao**: O campo de telefone no cadastro de parceiros nao tem mascara de formatacao.

**Solucao**: Utilizar a funcao `maskPhone` ja existente em `src/lib/masks.ts` para aplicar a mascara (XX) XXXXX-XXXX automaticamente.

---

## 3. Sistema de Indicacoes e Pagamentos

**Situacao Atual**: O sistema ja existe com os seguintes campos:
- Nome do cliente
- Percentual de comissao
- Valor total da causa
- Valor da comissao (calculado)
- Status (ativa, fechada, cancelada)
- Descricao do caso
- Area de atuacao

E o sistema de pagamentos permite:
- Pagamentos parcelados
- Vincular a indicacoes
- Tipo (a receber ou a pagar)
- Forma de pagamento

**Melhorias Propostas**: O sistema atual ja atende a maior parte das necessidades. As melhorias serao:
- Melhorar a visualizacao das indicacoes na tela de detalhes
- Adicionar mais campos se necessario

---

## Alteracoes Tecnicas

### Arquivo 1: Migracao de Banco de Dados

Criar nova politica RLS para permitir que usuarios aprovados cadastrem parceiros:

```sql
-- Permitir que usuarios aprovados possam cadastrar parceiros
CREATE POLICY "Usuarios aprovados podem criar parceiros"
ON public.parceiros FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir que usuarios aprovados criem indicacoes
CREATE POLICY "Usuarios aprovados podem criar indicacoes"
ON public.parceiros_indicacoes FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir que usuarios aprovados criem pagamentos
CREATE POLICY "Usuarios aprovados podem criar pagamentos"
ON public.parceiros_pagamentos FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir vinculacao de areas
CREATE POLICY "Usuarios aprovados podem vincular areas"
ON public.parceiros_areas FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));
```

### Arquivo 2: src/components/parceiros/ParceiroDialog.tsx

Adicionar mascara no campo telefone:

```typescript
import { maskPhone } from '@/lib/masks';

// No input de telefone:
<Input
  id="telefone"
  value={formData.telefone}
  onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
  placeholder="(XX) XXXXX-XXXX"
  maxLength={15}
/>
```

### Arquivo 3: src/components/parceiros/IndicacaoDialog.tsx

Adicionar mascara de moeda no campo valor e melhorar UX:

```typescript
// Formatar valores monetarios de forma mais amigavel
// Adicionar campo de observacoes
// Melhorar feedback visual do calculo de comissao
```

---

## Resumo das Mudancas

| Componente | Alteracao |
|------------|-----------|
| Banco de Dados | Novas politicas RLS para INSERT |
| ParceiroDialog.tsx | Mascara de telefone |
| IndicacaoDialog.tsx | Melhorias visuais e UX |

---

## Fluxo Apos Implementacao

```text
Usuario abre tela de Parceiros
      |
      v
Clica em "Novo Parceiro"
      |
      v
Preenche dados (telefone com mascara automatica)
      |
      v
Salva --> Politica RLS permite INSERT
      |
      v
Parceiro cadastrado com sucesso
      |
      v
Pode adicionar indicacoes e pagamentos
```

---

## Beneficios

1. **Correcao do erro**: Usuarios aprovados poderao cadastrar parceiros
2. **Padronizacao**: Telefone sempre formatado corretamente
3. **Melhor UX**: Feedback visual durante o preenchimento
4. **Integracao financeira**: Sistema ja integrado com financeiro via triggers
