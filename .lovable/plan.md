

## Correção: Tutorial abrindo toda vez no login

### Problema
O estado "tutorial já visto" é salvo no `localStorage` do navegador. Quando o usuário faz logout (e o `localStorage` é limpo pelo `signOut`) ou troca de navegador/dispositivo, o estado é perdido e o tutorial reaparece.

### Solução

**1. Migração — Criar tabela `tutorial_seen`**

```sql
CREATE TABLE public.tutorial_seen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, page_key)
);
ALTER TABLE public.tutorial_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tutorial state" ON public.tutorial_seen
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**2. Atualizar `src/components/TutorialOverlay.tsx`**

- Importar `supabase` e `useAuth`
- No `useEffect`, verificar se existe registro em `tutorial_seen` para o `user_id` + `pageKey`
  - Se existe → não abrir
  - Se não existe → abrir o tutorial
- No `handleClose`, inserir registro em `tutorial_seen` (e manter o localStorage como fallback)
- Manter o botão "Ver tutorial" para reabrir manualmente

**3. Manter compatibilidade**

- Continuar verificando `localStorage` como fallback imediato (evita flash enquanto a query carrega)
- Se localStorage diz "visto" → não abre (mesmo antes da query retornar)
- Se a query retorna "visto" mas localStorage não tem → marca localStorage também

