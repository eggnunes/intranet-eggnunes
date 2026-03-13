

# Diagnóstico: Erro ao enviar mensagens de aniversário

## Problema Identificado

O erro **"Failed to send a request to the Edge Function"** ocorre porque a função `chatguru-birthday-messages` está configurada com `verify_jwt = true` no `config.toml`. Com o sistema de signing-keys atual, essa configuração causa rejeição da requisição antes mesmo do código da função executar.

A função já faz validação de autenticação internamente (verifica token, busca usuário, confirma role admin), então a verificação JWT na camada de infraestrutura é redundante e está bloqueando as chamadas.

## Correção

**Arquivo**: `supabase/config.toml`

Alterar:
```toml
[functions.chatguru-birthday-messages]
verify_jwt = false
```

A segurança é mantida porque a função já valida internamente:
1. Verifica `Authorization` header (linha 245-251)
2. Valida token com `getUser` (linha 254)
3. Confirma role `admin` (linha 263-275)

Nenhuma outra alteração é necessária.

