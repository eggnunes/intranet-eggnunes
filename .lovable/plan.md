
# Sistema Completo de WhatsApp Avisos

## Objetivo
Criar uma interface completa de WhatsApp dentro da aba "Comunicacao" da intranet, permitindo enviar e receber mensagens via Z-API, gerenciar conversas, anexar documentos, gravar/ouvir audios, agendar mensagens e usar templates com atalho de barra "/".

---

## Estrutura Geral

O sistema sera dividido em 5 partes principais:

1. **Banco de dados** - Novas tabelas para conversas, mensagens, agendamentos e templates
2. **Backend (Edge Functions)** - Funcao ampliada para enviar midia, gerenciar agendamentos
3. **Frontend** - Pagina completa estilo WhatsApp Web com lista de conversas, area de chat, templates
4. **Navegacao** - Nova entrada "WhatsApp Avisos" no menu Comunicacao do sidebar
5. **Webhook** - Atualizar o webhook para alimentar as conversas em tempo real

---

## 1. Banco de Dados (Migrations)

### Tabela `whatsapp_conversations`
Armazena as conversas agrupadas por numero de telefone do cliente.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| phone | text (unique) | Numero do cliente (formato 55...) |
| contact_name | text | Nome do contato |
| last_message_text | text | Ultima mensagem (preview) |
| last_message_at | timestamptz | Horario da ultima mensagem |
| unread_count | integer | Mensagens nao lidas |
| is_archived | boolean | Se a conversa esta arquivada |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

### Tabela `whatsapp_messages`
Armazena cada mensagem individual (enviada e recebida).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| conversation_id | uuid (FK) | Referencia a conversa |
| phone | text | Numero do contato |
| direction | text | 'inbound' ou 'outbound' |
| message_type | text | 'text', 'audio', 'image', 'document', 'video' |
| content | text | Texto da mensagem |
| media_url | text | URL da midia |
| media_mime_type | text | MIME type |
| media_filename | text | Nome do arquivo |
| zapi_message_id | text | ID da Z-API |
| status | text | 'pending', 'sent', 'delivered', 'read', 'failed' |
| sent_by | uuid | Usuario que enviou (mensagens outbound) |
| quoted_message_id | uuid | Mensagem citada (reply) |
| is_from_me | boolean | Se foi enviado pelo escritorio |
| created_at | timestamptz | Horario da mensagem |

### Tabela `whatsapp_scheduled_messages`
Para agendamento de mensagens futuras.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| phone | text | Numero destino |
| contact_name | text | Nome do contato |
| message_type | text | Tipo da mensagem |
| content | text | Texto |
| media_url | text | URL da midia (se houver) |
| scheduled_at | timestamptz | Quando enviar |
| status | text | 'pending', 'sent', 'cancelled', 'failed' |
| sent_at | timestamptz | Quando foi enviado |
| created_by | uuid | Quem agendou |
| created_at | timestamptz | Criacao |

### Tabela `whatsapp_templates`
Templates de mensagens rapidas com suporte a "/" slash command.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| shortcut | text | Atalho (ex: "/saudacao", "/cobranca") |
| title | text | Nome do template |
| content | text | Texto do template |
| category | text | Categoria (saudacao, cobranca, etc.) |
| created_by | uuid | Quem criou |
| is_shared | boolean | Se e compartilhado com todos |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

**RLS**: Todas as tabelas terao RLS habilitado, permitindo acesso apenas a usuarios autenticados.

**Realtime**: A tabela `whatsapp_messages` sera adicionada ao `supabase_realtime` para atualizacoes em tempo real.

---

## 2. Backend (Edge Functions)

### Atualizar `zapi-send-message`
Adicionar novas actions:

- **`send-audio`**: Envia audio via Z-API endpoint `/send-audio` (aceita URL)
- **`send-image`**: Envia imagem via `/send-image` (aceita URL + caption)
- **`send-document`**: Envia documento via `/send-document/{extension}` (aceita URL)
- **`get-chat-messages`**: Busca historico de mensagens da tabela `whatsapp_messages`

Cada envio:
1. Salva a mensagem na tabela `whatsapp_messages` com status 'pending'
2. Envia via Z-API
3. Atualiza o status para 'sent' ou 'failed'
4. Atualiza a `whatsapp_conversations` (last_message, timestamp)

### Atualizar `zapi-webhook`
Alem de salvar em `zapi_webhook_events`, tambem:
1. Criar/atualizar a conversa em `whatsapp_conversations`
2. Inserir a mensagem em `whatsapp_messages` (mensagens recebidas e enviadas por mim)
3. Incrementar `unread_count` para mensagens recebidas

### Nova Edge Function: `process-scheduled-whatsapp`
- Executada periodicamente (cron)
- Busca mensagens agendadas com `scheduled_at <= now()` e `status = 'pending'`
- Valida horario comercial (08:00-19:00 Brasilia)
- Envia via Z-API e atualiza status

---

## 3. Frontend - Pagina WhatsApp Avisos

### Estrutura da Pagina
Layout estilo WhatsApp Web com 3 areas:

```text
+--------------------+------------------------------------+
|                    |                                    |
|  Lista de          |    Area de Chat                    |
|  Conversas         |    (mensagens + input)             |
|                    |                                    |
|  - Busca           |    [header com nome/telefone]      |
|  - Filtros         |    [bolhas de mensagem]            |
|  - Cards           |    [input com / templates]         |
|  - Nova conversa   |    [anexos + audio + agendar]      |
|                    |                                    |
+--------------------+------------------------------------+
```

### Componentes Principais

1. **WhatsAppAvisosPage** (`src/pages/WhatsAppAvisos.tsx`)
   - Pagina principal com Layout
   - Gerencia estado de conversas e mensagens
   - Abas: Conversas | Agendadas | Templates

2. **WhatsAppConversationList** (`src/components/whatsapp/ConversationList.tsx`)
   - Lista lateral com busca e filtros
   - Card de cada conversa (nome, preview, hora, badge de nao lidas)
   - Botao para iniciar nova conversa (digitando numero)

3. **WhatsAppChatArea** (`src/components/whatsapp/ChatArea.tsx`)
   - Header com nome e telefone do contato
   - Scroll de mensagens com bolhas (estilo WhatsApp)
   - Suporte a texto, imagem, audio, documento
   - Player de audio inline para ouvir audios recebidos
   - Status de entrega (enviado, entregue, lido)

4. **WhatsAppMessageInput** (`src/components/whatsapp/MessageInput.tsx`)
   - Campo de texto com deteccao de "/" para slash commands
   - Popup de templates ao digitar "/"
   - Botao de anexar (imagem/documento)
   - Botao de gravar audio
   - Botao de agendar mensagem
   - Botao de enviar

5. **WhatsAppTemplatesManager** (`src/components/whatsapp/TemplatesManager.tsx`)
   - CRUD de templates
   - Upload em lote via arquivo CSV/TXT
   - Definir atalho "/" para cada template
   - Categorias de templates

6. **WhatsAppScheduledMessages** (`src/components/whatsapp/ScheduledMessages.tsx`)
   - Lista de mensagens agendadas
   - Status (pendente, enviada, cancelada)
   - Opcao de cancelar agendamento

### Funcionalidades do Chat

- **Slash Commands**: Ao digitar "/" no campo de mensagem, aparece uma lista flutuante com os templates disponiveis, filtrando conforme o usuario digita
- **Gravacao de Audio**: Botao de microfone inicia gravacao, exibe timer, botao de cancelar (X) e enviar (check)
- **Player de Audio**: Mensagens de audio recebidas exibem player inline com play/pause e barra de progresso
- **Anexos**: Botao de clipe abre seletor de arquivo, exibe preview antes de enviar
- **Agendamento**: Botao de relogio abre dialog para selecionar data/hora de envio
- **Tempo Real**: Mensagens recebidas aparecem instantaneamente via Supabase Realtime
- **Upload em lote de templates**: Aceita arquivo CSV com colunas "atalho, titulo, conteudo"

---

## 4. Navegacao

### Sidebar (`AppSidebar.tsx`)
Adicionar na secao "COMUNICACAO":
```
{ icon: Phone, path: '/whatsapp-avisos', label: 'WhatsApp Avisos' }
```

### Rota (`App.tsx`)
Adicionar rota protegida:
```
<Route path="/whatsapp-avisos" element={<ProtectedRoute><WhatsAppAvisos /></ProtectedRoute>} />
```

### Busca Global (`Layout.tsx`)
Adicionar item de busca:
```
{ path: '/whatsapp-avisos', label: 'WhatsApp Avisos', description: 'Mensagens WhatsApp para clientes', category: 'Comunicacao' }
```

---

## 5. Fluxo de Dados

### Envio de Mensagem
1. Usuario digita mensagem (ou seleciona template, grava audio, anexa arquivo)
2. Frontend chama `zapi-send-message` com action adequada (send-message, send-audio, send-image, send-document)
3. Edge Function salva em `whatsapp_messages` com status 'pending'
4. Edge Function envia via Z-API
5. Atualiza status e `whatsapp_conversations`
6. Frontend recebe atualizacao via Realtime

### Recebimento de Mensagem
1. Z-API envia webhook para `zapi-webhook`
2. Webhook salva em `zapi_webhook_events` (auditoria)
3. Webhook cria/atualiza `whatsapp_conversations`
4. Webhook insere em `whatsapp_messages`
5. Frontend recebe via Realtime e exibe na conversa

### Agendamento
1. Usuario agenda mensagem com data/hora
2. Salva em `whatsapp_scheduled_messages` com status 'pending'
3. Cron job executa `process-scheduled-whatsapp` a cada minuto
4. Valida horario comercial, envia e atualiza status

---

## Detalhes Tecnicos

### Arquivos a Criar
- `src/pages/WhatsAppAvisos.tsx`
- `src/components/whatsapp/ConversationList.tsx`
- `src/components/whatsapp/ChatArea.tsx`
- `src/components/whatsapp/MessageInput.tsx`
- `src/components/whatsapp/TemplatesManager.tsx`
- `src/components/whatsapp/ScheduledMessages.tsx`
- `supabase/functions/process-scheduled-whatsapp/index.ts`
- 1 migration SQL

### Arquivos a Modificar
- `src/App.tsx` (nova rota)
- `src/components/AppSidebar.tsx` (novo menu)
- `src/components/Layout.tsx` (busca global)
- `supabase/functions/zapi-send-message/index.ts` (novas actions)
- `supabase/functions/zapi-webhook/index.ts` (popular whatsapp_messages)
- `supabase/config.toml` (nova function)

### APIs Z-API Utilizadas
- `POST /send-text` - Envio de texto (ja existente)
- `POST /send-audio` - Envio de audio (URL ou base64)
- `POST /send-image` - Envio de imagem (URL ou base64 + caption)
- `POST /send-document/{ext}` - Envio de documento (URL + filename)

### Upload de Midia
Arquivos serao armazenados no Storage (bucket existente `task-attachments`) e a URL sera usada para envio via Z-API.
