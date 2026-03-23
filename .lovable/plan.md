

# Melhorar tratamento de erro de créditos na Edge Function `suggest-task`

## Problema
Quando a API da Anthropic retorna erro 400 por falta de créditos ("Your credit balance is too low"), a função não trata esse caso específico e exibe uma mensagem genérica.

## Solução
Adicionar tratamento para status 400 que detecta a mensagem de créditos insuficientes e retorna uma mensagem clara ao usuário.

## Mudança

### `supabase/functions/suggest-task/index.ts`
Adicionar no bloco de tratamento de erros (após o check de status 401, linha ~188):

- Tratar **status 400** verificando se o corpo contém "credit balance"
- Retornar mensagem clara: "A API de IA está sem créditos. Entre em contato com o administrador para recarregar os créditos da Anthropic."
- Também tratar **status 402** (payment required) com a mesma mensagem

| Arquivo | Ação |
|---------|------|
| `supabase/functions/suggest-task/index.ts` | **Editar** — adicionar tratamento de erro 400/402 para créditos insuficientes |

