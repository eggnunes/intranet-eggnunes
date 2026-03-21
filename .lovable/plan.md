

## Agentes de IA — Abas ChatGPT + Agentes da Intranet

### Visão Geral

Transformar a página `/agentes-ia` em interface com duas abas:
1. **Agentes do ChatGPT** — conteúdo atual (links externos)
2. **Agentes da Intranet** — sistema completo de criação e uso de agentes customizados

### Banco de Dados (Migração)

**Tabela `intranet_agents`:**
- `id` (uuid PK)
- `name` (text) — nome do agente
- `objective` (text) — objetivo
- `instructions` (text) — instruções detalhadas
- `model` (text) — modelo de IA selecionado automaticamente
- `icon_emoji` (text, default '🤖')
- `created_by` (uuid → auth.users)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

**Tabela `intranet_agent_files`:**
- `id` (uuid PK)
- `agent_id` (uuid → intranet_agents)
- `file_name` (text)
- `file_type` (text) — pdf, image, link, etc.
- `file_url` (text) — URL do storage ou link externo
- `file_size` (bigint, nullable)
- `created_at`

**Tabela `intranet_agent_conversations`:**
- `id` (uuid PK)
- `agent_id` (uuid → intranet_agents)
- `user_id` (uuid → auth.users)
- `title` (text)
- `created_at`, `updated_at`

**Tabela `intranet_agent_messages`:**
- `id` (uuid PK)
- `conversation_id` (uuid → intranet_agent_conversations)
- `role` (text) — user/assistant
- `content` (text)
- `created_at`

**Storage bucket:** `agent-files` (privado)

**RLS:** Todos os usuários aprovados podem ver agentes ativos. Apenas o criador ou admin pode editar/deletar agentes. Mensagens acessíveis apenas pelo próprio usuário.

### Edge Functions

**1. `suggest-agent-instructions`** (nova)
- Recebe: nome do agente, objetivo, texto livre do usuário
- Usa Claude Sonnet 4 (ANTHROPIC_API_KEY) para gerar instruções detalhadas e estruturadas
- Retorna instruções sugeridas

**2. `select-agent-model`** (nova)
- Recebe: instruções do agente
- Usa IA para analisar instruções e escolher modelo ideal:
  - Análise jurídica/petições complexas → `claude-sonnet-4-20250514` (Anthropic)
  - Cálculos/raciocínio lógico → `openai/gpt-5` (Lovable Gateway)
  - Pesquisa/busca web → `sonar-pro` (Perplexity)
  - Conteúdo/redação geral → `google/gemini-2.5-flash` (Lovable Gateway)
- Retorna modelo recomendado + justificativa

**3. `chat-with-agent`** (nova)
- Recebe: agent_id, messages[], attachments context
- Carrega instruções do agente + arquivos da base de conhecimento
- Roteia para o modelo correto (Anthropic, OpenAI, Lovable Gateway ou Perplexity)
- Suporta streaming SSE
- Envia system prompt com instruções + conteúdo dos documentos anexados

### Frontend

**1. Página `AgentesIA.tsx` — Reestruturar com Tabs:**
- Tab "Agentes do ChatGPT" → conteúdo atual (cards com links)
- Tab "Agentes da Intranet" → lista de agentes criados + botão "Criar Novo Agente"

**2. Componente `CreateAgentDialog.tsx`:**
- Campos: Nome, Objetivo, Instruções (textarea grande)
- Botão "Sugerir Instruções com IA" (texto ou voz via Whisper)
- Upload de arquivos (PDF, imagens, links) como base de conhecimento
- Modelo IA selecionado automaticamente ao salvar (com indicação visual)
- Preview do agente antes de salvar

**3. Componente `AgentChat.tsx`:**
- Abre como página/aba separada (`/agentes-ia/:agentId`)
- Interface de chat com streaming (similar ao AssistenteIA existente)
- Mostra nome/objetivo do agente no header
- Histórico de conversas
- Input de texto + voz

**4. Rota nova em `App.tsx`:**
- `/agentes-ia/:agentId` → página de chat com o agente

### Arquivos a criar/editar
- `src/pages/AgentesIA.tsx` — reestruturar com tabs
- `src/components/agents/CreateAgentDialog.tsx` — formulário de criação
- `src/components/agents/AgentChat.tsx` — interface de chat
- `src/pages/AgenteChatPage.tsx` — página wrapper para chat
- `src/App.tsx` — adicionar rota
- `supabase/functions/suggest-agent-instructions/index.ts`
- `supabase/functions/select-agent-model/index.ts`
- `supabase/functions/chat-with-agent/index.ts`
- Migração SQL para tabelas + RLS + bucket

