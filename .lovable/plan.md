## Corrigir erros no sistema TOTP

### Problema 1: "Erro ao buscar códigos" intermitente

A edge function `totp-generate` valida o JWT do usuário via `supabase.auth.getUser()`. Quando o token expira entre ciclos de 30 segundos, a chamada falha com 401, e o componente exibe "Erro ao buscar códigos TOTP". O usuário precisa fazer logout e login de novo.

**Causa**: O `TOTPCodeDisplay` chama `supabase.functions.invoke('totp-generate')` a cada 30s, mas não tenta renovar a sessão quando recebe erro de autenticação.

**Correção em `src/components/TOTPCodeDisplay.tsx**`:

- Ao receber erro da edge function (especialmente 401/403 ou mensagens JWT), usar `supabase.auth.refreshSession()` para renovar o token e repetir a chamada automaticamente
- Só mostrar toast de erro se a retry também falhar
- Não mostrar toast em erros silenciosos de rede (evitar spam)

### Alterações

**Arquivo `src/components/TOTPCodeDisplay.tsx**`:

- Adicionar retry com refresh de sessão no `fetchCodesFromServer`
- Suprimir toast de erro na primeira falha; só exibir se retry falhar
  &nbsp;

### Resultado

- Códigos TOTP não darão mais erro intermitente — sessão será renovada automaticamente
  &nbsp;