

# Central de Automações WhatsApp Avisos

## Resumo

Criar uma "Central de Automações" na página WhatsApp Avisos, onde o usuário gerencia quais mensagens automáticas são enviadas pelo número de avisos (Z-API). As mensagens de aniversário passam a ser enviadas via Z-API (em vez de ChatGuru), com intervalo de 2 minutos entre envios. Inclui geração de mensagens com IA (texto ou áudio).

## Mudanças no banco de dados

**Nova tabela: `whatsapp_automation_rules`**
- `id` UUID PK
- `name` TEXT — nome da automação (ex: "Aniversário de Clientes")
- `type` TEXT — tipo: `birthday`, `boleto`, `custom`
- `message_template` TEXT — conteúdo da mensagem (suporta variáveis como `{nome}`)
- `is_active` BOOLEAN DEFAULT false
- `send_via` TEXT DEFAULT 'zapi' — canal de envio (`zapi`, `chatguru`)
- `interval_seconds` INTEGER DEFAULT 120 — intervalo entre envios (padrão: 2 min)
- `created_by` UUID
- `created_at`, `updated_at` TIMESTAMPTZ
- RLS: leitura para aprovados, escrita para admins

## Mudanças na Edge Function `chatguru-birthday-messages`

Refatorar para:
1. Consultar `whatsapp_automation_rules` onde `type = 'birthday'` e `is_active = true`
2. Se `send_via = 'zapi'`: enviar via Z-API (`zapi-send-message` / `send-text`) usando o template da regra, com intervalo de 2 min entre envios e footer de avisos
3. Se `send_via = 'chatguru'`: manter lógica atual (fallback)
4. Manter idempotência pelo log existente (`chatguru_birthday_messages_log`)
5. O intervalo de 2 minutos exige processamento assíncrono — usar `EdgeRuntime.waitUntil()` para enviar em background enquanto retorna resposta parcial ao front

## Nova aba "Automações" na página WhatsApp Avisos

**Arquivo: `src/components/whatsapp/AutomationsManager.tsx`** (novo)
- Lista as automações cadastradas em `whatsapp_automation_rules`
- Switch para ativar/desativar cada automação
- Dialog para criar/editar automação com:
  - Nome, tipo, template da mensagem, intervalo entre envios
  - Botão "Gerar com IA" que permite digitar prompt ou gravar áudio → envia para Edge Function que gera o texto da mensagem
  - Preview com variáveis substituídas (ex: `{nome}` → "João")
- Já vir com automação de aniversário pré-cadastrada (seed via migration INSERT) com `is_active = true` e `send_via = 'zapi'`

**Arquivo: `src/pages/WhatsAppAvisos.tsx`**
- Adicionar nova aba "Automações" com ícone `Zap`/`Bot`

## Geração de mensagem com IA

**Nova Edge Function: `generate-automation-message/index.ts`**
- Recebe `{ prompt, audioBase64? }`
- Se `audioBase64`: transcreve via Whisper (já existe a lógica em `voice-to-text`)
- Envia para Lovable AI (Gemini Flash) com system prompt jurídico/amigável para gerar mensagem padronizada
- Retorna o texto gerado

## Ajustes na lógica de envio

- Na função `chatguru-birthday-messages`, o envio via Z-API usa a action `send-message` de `zapi-send-message` internamente (chamada HTTP interna) ou replica a lógica de `callZAPI` diretamente
- Intervalo configurável por regra (default 120s = 2 min)
- Como 2 min × 35 mensagens = 70 min (excede timeout), usar `EdgeRuntime.waitUntil()` para o loop de envio e retornar imediatamente com status "envio iniciado"
- O front mostrará "Envio em andamento" e o histórico pode ser consultado no log

## Arquivos a criar/editar

1. **Migration SQL** — criar tabela `whatsapp_automation_rules` + seed da automação de aniversário ativa
2. **`src/components/whatsapp/AutomationsManager.tsx`** (novo) — UI da central de automações
3. **`supabase/functions/generate-automation-message/index.ts`** (novo) — gerar mensagem com IA
4. **`supabase/functions/chatguru-birthday-messages/index.ts`** — refatorar para ler regra ativa e enviar via Z-API com `EdgeRuntime.waitUntil()` + intervalo de 2 min
5. **`src/pages/WhatsAppAvisos.tsx`** — adicionar aba Automações
6. **`src/pages/AniversariosClientes.tsx`** — ajustar texto do toast para refletir envio via Z-API
7. **`supabase/config.toml`** — adicionar entry para `generate-automation-message`

