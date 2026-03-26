

## Restringir acesso ao ranking de tarefas apenas para administradores

### O que será feito
Adicionar verificação de permissão na página `DistribuicaoTarefas.tsx` para que apenas administradores (admins/sócios) possam acessá-la. Não-admins verão tela de "Acesso Restrito".

### Alteração
**Arquivo:** `src/pages/DistribuicaoTarefas.tsx`

- O hook `useUserRole` já está importado e retorna `isAdmin`
- Adicionar guard no início do componente: se `isAdmin` for `false` (e não estiver carregando), renderizar card de acesso restrito com ícone e mensagem, igual ao padrão usado em `CRM.tsx` e outras páginas
- Manter o `Layout` wrapper para consistência visual

### Padrão seguido
Mesmo padrão de `src/pages/CRM.tsx` que usa `hasPermission` para bloquear acesso, mas aqui usaremos diretamente `isAdmin` do `useUserRole` já disponível no componente.

