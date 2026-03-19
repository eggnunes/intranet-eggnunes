

# Correção: Mensagens de Aniversário não aparecem no WhatsApp Avisos

## Problema Identificado

A função `chatguru-birthday-messages` envia mensagens de aniversário diretamente pela Z-API, mas **não registra essas mensagens** nas tabelas `whatsapp_conversations` e `whatsapp_messages`. Por isso, as mensagens são enviadas com sucesso pelo WhatsApp, mas não aparecem na interface do "WhatsApp Avisos" da intranet.

A função `zapi-send-message` (usada pelo chat manual) tem a lógica `saveMessageAndUpdateConversation` que faz esse registro. A função de aniversários não usa essa lógica.

## Correção

### Arquivo: `supabase/functions/chatguru-birthday-messages/index.ts`

Após cada envio bem-sucedido via `sendBirthdayViaZapi`, adicionar lógica para:

1. **Buscar ou criar a conversa** na tabela `whatsapp_conversations` usando o telefone do cliente
2. **Inserir a mensagem** na tabela `whatsapp_messages` com:
   - `direction: 'outbound'`
   - `message_type: 'text'`
   - `content`: o texto real da mensagem (com template preenchido)
   - `is_from_me: true`
   - `status: 'sent'`
   - `sent_by`: o ID do usuário que disparou
3. **Atualizar `last_message_text` e `last_message_at`** na conversa

A função `sendBirthdayViaZapi` será ajustada para retornar o texto final da mensagem e o resultado da Z-API (com `zaapId`), permitindo salvar o conteúdo exato e o ID da mensagem.

Isso replica a mesma lógica de `saveMessageAndUpdateConversation` já usada no `zapi-send-message`, garantindo que todas as mensagens enviadas (manuais ou automáticas) apareçam no histórico do WhatsApp Avisos.

### Resultado
- Mensagens de aniversário passarão a aparecer nas conversas do WhatsApp Avisos
- Se o cliente já tiver uma conversa, a mensagem aparece nela
- Se não tiver, uma nova conversa é criada automaticamente
- O histórico fica completo e auditável

