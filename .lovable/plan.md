

# Correção: Erro "JWT expirado" ao cadastrar fornecedores

## Diagnóstico

O erro **não é de Edge Function** — a operação de cadastro usa chamada direta ao banco (`supabase.from('fornecedores_uteis').insert()`). O token JWT do usuário expirou e o auto-refresh falhou silenciosamente, resultando no erro "JWT expirado" ao tentar inserir.

As políticas RLS estão corretas. O problema é puramente de sessão expirada não tratada.

## Correção

### 1. Adicionar tratamento de sessão expirada no save do fornecedor (`src/pages/CadastrosUteis.tsx`)

Antes de executar insert/update, tentar refresh da sessão. Se o erro retornado contiver "JWT" ou "token", forçar refresh e retentar automaticamente uma vez. Se falhar de novo, redirecionar para login.

### 2. Criar hook utilitário reutilizável (`src/hooks/useSessionRefresh.tsx`)

Hook que expõe uma função `ensureValidSession()`:
- Chama `supabase.auth.refreshSession()`
- Se falhar, chama `signOut()` e redireciona para `/auth`
- Retorna `true` se sessão válida, `false` se expirada

### 3. Aplicar no componente de fornecedores

No `handleSave`:
- Chamar `ensureValidSession()` antes do insert/update
- Se o erro for JWT-related, tentar refresh + retry uma vez
- Se persistir, mostrar toast "Sessão expirada, faça login novamente" e redirecionar

### Detalhes técnicos

```typescript
// useSessionRefresh.tsx
export const useSessionRefresh = () => {
  const { signOut } = useAuth();
  
  const ensureValidSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await signOut();
      return false;
    }
    return true;
  };

  const retryWithRefresh = async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('jwt')) {
        const refreshed = await ensureValidSession();
        if (refreshed) return await operation();
      }
      throw e;
    }
  };

  return { ensureValidSession, retryWithRefresh };
};
```

No `CadastrosUteis.tsx`, o save fará:
1. `await ensureValidSession()` — se falso, aborta
2. Executa insert/update normalmente
3. Se erro contém "JWT"/"token", tenta refresh + retry
4. Se falhar novamente, toast + redirect para `/auth`

### Arquivos alterados
- `src/hooks/useSessionRefresh.tsx` (novo)
- `src/pages/CadastrosUteis.tsx` (tratamento de erro no save, delete)

