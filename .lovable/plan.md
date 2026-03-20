

# Renomeação: ChatGuru → Birthday Messages (Z-API)

## Escopo

Remover todas as referências ao "ChatGuru" na funcionalidade de mensagens de aniversário, já que agora usa exclusivamente a Z-API.

**Nota:** A função `send-document-request` ainda usa a API do ChatGuru de fato (templates WABA), então essa não será alterada neste momento.

## Alterações

### 1. Renomear a tabela no banco de dados
- Migration: `ALTER TABLE chatguru_birthday_messages_log RENAME TO birthday_messages_log`
- Renomear coluna: `chatguru_message_id` → `zapi_message_id`

### 2. Criar nova Edge Function `birthday-messages`
- Copiar conteúdo de `chatguru-birthday-messages/index.ts` para `birthday-messages/index.ts`
- Atualizar todas as referências de `chatguru_birthday_messages_log` → `birthday_messages_log`
- Registrar em `config.toml`

### 3. Remover Edge Function antiga
- Deletar `supabase/functions/chatguru-birthday-messages/index.ts`
- Remover entrada do `config.toml`

### 4. Atualizar frontend (3 arquivos)
- **`src/pages/AniversariosClientes.tsx`**: `invoke('birthday-messages')`
- **`src/pages/HistoricoMensagensAniversario.tsx`**: `.from('birthday_messages_log')`, campo `zapi_message_id`
- **`src/components/BirthdayMessageFailuresAlert.tsx`**: `.from('birthday_messages_log')`
- **`src/components/CollectionMessagesHistory.tsx`**: `.from('birthday_messages_log')`

### 5. Referências visuais ao ChatGuru
- **`src/components/crm/CRMWhatsAppLogs.tsx`**: Trocar texto "ChatGuru" por "WhatsApp"

## Arquivos alterados
1. Migration SQL (renomear tabela + coluna)
2. `supabase/functions/birthday-messages/index.ts` (novo)
3. `supabase/functions/chatguru-birthday-messages/` (deletar)
4. `src/pages/AniversariosClientes.tsx`
5. `src/pages/HistoricoMensagensAniversario.tsx`
6. `src/components/BirthdayMessageFailuresAlert.tsx`
7. `src/components/CollectionMessagesHistory.tsx`
8. `src/components/crm/CRMWhatsAppLogs.tsx`

