

## Corrigir histórico e salvos de jurisprudência aparecendo vazios

### Causa raiz

Os dados existem no banco (82 pesquisas e 4 jurisprudências salvas). O problema é que as queries usam um JOIN com profiles (`profiles:user_id(full_name)`) mas a tabela `jurisprudence_searches` **não tem foreign key** para `profiles`. Isso faz a query do Supabase falhar silenciosamente, retornando erro que é capturado no catch e resulta em lista vazia.

### Solução

**1. Migration — Adicionar foreign keys para profiles** nas duas tabelas:
- `jurisprudence_searches.user_id → profiles.id`
- `saved_jurisprudence.user_id → profiles.id`

**2. Nenhuma alteração de código necessária** — o frontend já faz os JOINs corretamente, só faltava a FK no banco.

### Arquivo alterado
- Nova migration SQL (adicionar 2 foreign keys)

