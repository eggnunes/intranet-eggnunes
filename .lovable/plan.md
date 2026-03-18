

# Correção: Remover ChatGuru e Usar Apenas Z-API (WhatsApp de Avisos)

## Problema
A edge function `chatguru-birthday-messages` ainda tem o ChatGuru como fallback padrão (linha 192: `sendVia = automationRule?.send_via || 'chatguru'`). Isso significa que se a regra de automação não for encontrada ou não tiver `send_via` definido, o sistema tenta enviar pelo ChatGuru em vez do Z-API. Além disso, mensagens registradas como "sent" pelo ChatGuru bloqueiam o reenvio via Z-API porque a verificação de idempotência não distingue o canal.

## Solução

### 1. Edge Function `chatguru-birthday-messages/index.ts`
- Alterar o default de `'chatguru'` para `'zapi'` na linha 192
- Remover todo o código do ChatGuru (funções `setChatStatusToAttending` e `sendBirthdayViaDialog`) — simplifica e elimina o risco de uso acidental
- Remover a validação de credenciais do ChatGuru (linhas 199-202)
- Manter apenas a lógica de envio via Z-API

### 2. Migração SQL
- Adicionar coluna `send_via` na tabela `chatguru_birthday_messages_log` para rastrear o canal
- Marcar os 7 registros de hoje com status `sent` como `failed` (foram registrados via ChatGuru mas nunca entregues pelo Z-API), liberando o reenvio

### 3. Frontend `AniversariosClientes.tsx`
- Adicionar botão "Reenviar Mensagens" quando `total === 0` e `alreadySentToday > 0`, passando `forceResend: true`
- Na edge function, aceitar `forceResend` para ignorar a trava de idempotência

### Arquivos
1. **`supabase/functions/chatguru-birthday-messages/index.ts`** — remover ChatGuru, default Z-API, suporte `forceResend`
2. **Migração SQL** — coluna `send_via` + correção dos registros falsos
3. **`src/pages/AniversariosClientes.tsx`** — botão de reenvio

