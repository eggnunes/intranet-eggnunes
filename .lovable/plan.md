

## Plano: Tornar pesquisas e jurisprudências salvas visíveis para todos os usuários

### Problema
As políticas RLS de SELECT nas tabelas `jurisprudence_searches` e `saved_jurisprudence` filtram por `user_id = auth.uid()`, fazendo com que cada usuário veja apenas seus próprios registros.

### Correção

**1. Atualizar políticas RLS (migração SQL)**

Substituir as políticas de SELECT de ambas as tabelas para permitir leitura por qualquer usuário aprovado:

- `jurisprudence_searches`: DROP policy "Usuários podem ver suas próprias pesquisas" → CREATE policy com `USING (public.is_approved(auth.uid()))`
- `saved_jurisprudence`: DROP policy "Usuários podem ver suas jurisprudências salvas" → CREATE policy com `USING (public.is_approved(auth.uid()))`

As políticas de INSERT, UPDATE e DELETE permanecem restritas ao próprio usuário (sem alteração).

**2. Atualizar frontend (`src/pages/PesquisaJurisprudencia.tsx`)**

- Nas funções `fetchHistory` e `fetchSaved`: remover qualquer filtro `.eq('user_id', ...)` se existir (atualmente não há filtro explícito no código, então a mudança de RLS já resolve).
- Adicionar exibição do nome do autor em cada item do histórico e jurisprudências salvas, fazendo join com `profiles`:
  - Alterar queries para incluir `user_id` e fazer um select com informação do perfil, ou buscar separadamente.
- Restringir exclusão apenas ao autor do registro (mostrar botão de delete apenas quando `item.user_id === user?.id` ou quando o usuário é sócio).

**3. Atualizar `src/pages/Profile.tsx`**

- Na seção de jurisprudências salvas do perfil, manter o filtro `.eq('user_id', user.id)` para mostrar apenas as do próprio usuário nessa página específica.

### Arquivos modificados
- Migração SQL — 2 políticas RLS atualizadas
- `src/pages/PesquisaJurisprudencia.tsx` — exibir autor, restringir botão de exclusão
- `src/pages/Profile.tsx` — adicionar filtro explícito por user_id (caso não tenha)

