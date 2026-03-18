

# Separar Ativos/Inativos + Adicionar Suspensão Temporária

## Situação Atual

- O campo `is_active` (boolean) existe na tabela `profiles` e é usado para desligar colaboradores
- Na página Admin (aba Usuários), ativos e inativos aparecem juntos, diferenciados apenas por um badge "Inativo"
- Filtro de status já existe (`userStatusFilter`) mas a listagem é uma lista única
- Várias páginas já filtram por `is_active = true`: Mensagens, RH, Folgas, VacationDashboard, WhatsApp, etc.
- Porém, diversas páginas **não filtram** por `is_active`: Equipe, Férias, Aniversários, Dashboard (aniversários), HomeOffice, Fórum — esses precisam ser corrigidos
- Não existe conceito de "suspensão temporária" — apenas ativo/inativo
- A função DB `is_approved()` já verifica `is_active = true`, então usuários inativos já são bloqueados pelo RLS em muitas operações

## Plano

### 1. Migração: adicionar coluna `is_suspended` na tabela `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN suspended_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN suspended_at TIMESTAMPTZ;
```

Atualizar a função `is_approved()` para também verificar `is_suspended = false`:

```sql
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean ...
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id 
    AND approval_status = 'approved'
    AND is_active = true
    AND is_suspended = false
  )
$$;
```

### 2. Admin — Separar ativos e inativos em abas + adicionar suspensão

Na aba "Usuários" do `src/pages/Admin.tsx`:
- Substituir o filtro de status (select "Ativos/Inativos") por **sub-abas internas**: "Ativos", "Suspensos", "Desligados"
- Ativos: `is_active = true AND is_suspended = false`
- Suspensos: `is_active = true AND is_suspended = true`
- Desligados: `is_active = false`

No dialog "Editar Perfil" (ações administrativas):
- Renomear "Inativar" para "Desligar Colaborador" (permanente)
- Adicionar botão "Suspender Acesso" (temporário) com campo para motivo
- Se já suspenso, mostrar "Reativar Acesso"
- Se já desligado, mostrar "Reativar Colaborador"

### 3. Filtrar inativos/suspensos de TODAS as listagens de colaboradores

Adicionar `.eq('is_active', true)` nas queries que faltam (e no futuro `.eq('is_suspended', false)`):

- `src/pages/Equipe.tsx` — `fetchTeam()`: adicionar `.eq('is_active', true).eq('is_suspended', false)`
- `src/pages/Ferias.tsx` — `fetchProfiles()`: adicionar `.eq('is_active', true).eq('is_suspended', false)`
- `src/pages/Aniversarios.tsx` — `fetchBirthdays()`: adicionar `.eq('is_active', true).eq('is_suspended', false)`
- `src/pages/Dashboard.tsx` — `fetchMonthBirthdays()`: adicionar `.eq('is_active', true).eq('is_suspended', false)`
- `src/pages/HomeOffice.tsx` — `fetchLawyers()`: adicionar `.eq('is_active', true).eq('is_suspended', false)`
- `src/pages/ForumTopic.tsx` — fetch de profiles: adicionar `.eq('is_active', true).eq('is_suspended', false)`

Nas queries que já filtram `is_active = true`, adicionar `.eq('is_suspended', false)` em:
- `src/components/rh/RHColaboradores.tsx`, `RHPagamentos.tsx`, `RHAdiantamentos.tsx`, `RHFolgas.tsx`, `RHDashboard.tsx`, `RHColaboradorDashboard.tsx`, `PromocaoDialog.tsx`
- `src/components/VacationDashboard.tsx`
- `src/pages/Mensagens.tsx`, `DecisoesFavoraveis.tsx`
- `src/components/whatsapp/ContactDetailsPanel.tsx`, `InternalCommentInput.tsx`, `ConversationFilters.tsx`

### 4. Bloquear login de suspensos

No `src/components/ProtectedRoute.tsx` ou no `Layout.tsx`: após autenticar, buscar o profile e verificar se `is_suspended = true`. Se sim, exibir tela de "Acesso Suspenso Temporariamente" com o motivo, e botão de logout. Mesma lógica para `is_active = false` → "Seu acesso foi desativado".

### 5. Atualizar `useUserRole.tsx`

Adicionar `is_suspended` ao `UserProfile` interface e expor `isSuspended` no retorno do hook.

## Arquivos a criar/editar

1. **Migration SQL** — adicionar `is_suspended`, `suspended_reason`, `suspended_at` + atualizar `is_approved()`
2. **`src/pages/Admin.tsx`** — sub-abas Ativos/Suspensos/Desligados + botões Suspender/Desligar
3. **`src/hooks/useUserRole.tsx`** — adicionar `is_suspended` ao interface
4. **`src/components/ProtectedRoute.tsx`** — bloquear acesso de suspensos/inativos com tela dedicada
5. **~15 arquivos** de listagem de perfis — adicionar filtros `is_active` e `is_suspended`

