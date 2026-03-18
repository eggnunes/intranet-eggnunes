

# Perfil Completo do Colaborador — Acessível via Admin e pelo Próprio Usuário

## Problema Atual

1. **Na página Admin (Usuários)**: ao clicar em um colaborador, abre apenas um dialog de edição — não há link para ver o perfil completo com férias, folgas, pagamentos, etc.
2. **Na página Perfil (`/profile`)**: o colaborador vê seus dados pessoais, mas **não vê férias, folgas, home office, promoções, histórico salarial** — esses dados só existem no `ColaboradorPerfilUnificado`, que é restrito a admins/sócios (página `/rh`).

## Solução

### 1. Adicionar botão "Ver Perfil Completo" na página Admin

Na listagem de usuários em `src/pages/Admin.tsx`, ao lado do botão "Editar Perfil", adicionar um botão/ícone que navega para `/rh?colaboradorId={userId}`, abrindo o perfil unificado completo.

### 2. Enriquecer a página Perfil (`/profile`) com dados completos

Em `src/pages/Profile.tsx`, adicionar seções que já existem no `ColaboradorPerfilUnificado`:
- **Férias**: histórico de `vacation_requests` do usuário (períodos, dias, status)
- **Folgas**: registros de `rh_folgas` do usuário
- **Home Office**: utilizações de `home_office_schedules` do usuário
- **Promoções**: histórico de `rh_promocoes`
- **Férias Informais**: componente `InformalVacationSummary` (apenas para admins/sócios, como já está)

Esses dados serão visíveis ao **próprio usuário** (sem necessidade de ser admin). Dados financeiros sensíveis (pagamentos, salário) já estão no perfil e continuam com as regras atuais.

### 3. Permitir que o próprio usuário acesse seu perfil unificado no RH

Em `src/pages/RH.tsx`, ajustar a lógica de acesso: se o `colaboradorId` na URL é o **próprio usuário logado**, permitir o acesso mesmo sem ser admin/sócio. Isso garante que o link do Admin também funcione corretamente.

Alternativamente (e mais simples): como já vamos adicionar os dados na página `/profile`, o acesso pelo próprio usuário fica em `/profile` e o acesso admin fica via `/rh`.

## Arquivos a editar

1. **`src/pages/Admin.tsx`** — adicionar botão "Ver Perfil" que navega para `/rh?colaboradorId=X`
2. **`src/pages/Profile.tsx`** — adicionar seções de férias, folgas, home office e promoções, buscando dados do próprio usuário logado
3. **`src/pages/RH.tsx`** — permitir acesso ao perfil unificado quando o `colaboradorId` é o próprio usuário (para que o link do admin funcione para o próprio admin vendo seu perfil)

## Regras de Acesso

- **Perfil próprio (`/profile`)**: qualquer usuário autenticado vê seus próprios dados completos
- **Perfil de outro colaborador (`/rh?colaboradorId=X`)**: apenas admins e sócios
- Dados financeiros (pagamentos, salário) no perfil próprio mantêm a visibilidade atual
- Documentos médicos continuam restritos a admins/sócios

