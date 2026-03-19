

# Correção: Mensagens do WhatsApp não aparecem na Intranet

## Diagnóstico

Investiguei os dados do webhook e encontrei o problema raiz:

A função `extractEventType` no webhook está classificando os eventos incorretamente:

- **Mensagens reais** chegam da Z-API com `type: "ReceivedCallback"`, mas o código trata TODOS os `ReceivedCallback` como eventos de sistema (linha 17-21), descartando as mensagens antes de salvá-las
- **Callbacks de status** (`MessageStatusCallback`, `PresenceChatCallback`) não estão na lista de filtro, então passam como "mensagens recebidas", mas como não têm texto nem mídia, são descartadas depois — gerando ruído nos logs

Resultado: de 2.316 eventos recebidos pelo webhook, apenas 3 mensagens foram salvas (todas enviadas manualmente pela interface). Nenhuma mensagem real (enviada ou recebida pelo celular) foi persistida.

## Solução

### 1. Corrigir `extractEventType` na Edge Function `zapi-webhook`
- Adicionar `MessageStatusCallback` e `PresenceChatCallback` à lista de callbacks de sistema
- Mudar a lógica do `ReceivedCallback`: quando o payload contiver conteúdo real (`body`, `text.message`, `image`, `audio`, etc.), classificar como mensagem e não como evento de sistema
- Só tratar `ReceivedCallback` como `message_status` quando NÃO houver conteúdo de mensagem

### 2. Corrigir detecção de mensagens enviadas
- Mensagens enviadas via Z-API também chegam como `ReceivedCallback` com `fromMe: true` — garantir que sejam classificadas como `sent_message`

### 3. Ajustar `extractMessageType`
- Quando `type` é `ReceivedCallback` ou `MessageStatusCallback`, não retornar esse valor como tipo de mensagem — extrair o tipo real do conteúdo (text, image, audio, etc.)

## Arquivos
- `supabase/functions/zapi-webhook/index.ts` — correção da classificação de eventos

## Resultado esperado
Após a correção, todas as mensagens enviadas e recebidas pelo WhatsApp de Avisos serão salvas automaticamente e aparecerão na interface da intranet.

