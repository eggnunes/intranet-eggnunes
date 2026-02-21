

## Correção: Edge Function `pje-publicacoes` inacessível

### Problema
O erro "Failed to send a request to the Edge Function" indica que a requisição nem chega à função. A causa é `verify_jwt = true` no `config.toml` para `pje-publicacoes`. O sistema de signing-keys do Lovable Cloud não é compatível com essa configuração — ela bloqueia todas as requisições antes que o código execute.

### Solução
Uma única mudança:

**`supabase/config.toml` linha 148:** trocar `verify_jwt = true` por `verify_jwt = false`

A função já faz validação de autenticação manualmente no código (linhas 65-80 do `index.ts`), então a segurança está preservada.

### Resultado
Após essa mudança, o botão "Buscar na API do CNJ" conseguirá alcançar a edge function, que por sua vez rodará em `sa-east-1` (São Paulo) conforme já configurado no frontend, e fará a consulta à API do CNJ com IP brasileiro.
