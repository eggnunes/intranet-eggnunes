# Sistema Completo de E-mails Automáticos via Resend

## Visão Geral

Criar um sistema abrangente de envio de e-mails automáticos usando a API Resend já configurada, com o remetente `avisos@intranetagnunes.com.br`. O sistema terá dois tipos de envio: **imediato** (disparado por eventos) e **diário** (resumos agendados via cron).

---

## Componentes a Implementar

### 1. Edge Function: `send-daily-digest` (NOVA)

Função agendada via pg_cron que roda uma vez por dia (ex: 7h da manhã, horário de Brasília) e envia resumos personalizados por cargo/setor:

**Para TODOS os colaboradores ativos:**

- Mensagens internas recebidas nas últimas 24h (tabela `messages`)
- Novos avisos/comunicados publicados (tabela `announcements`)
- Atualizações da intranet (tabela `intranet_updates`)
- Tarefas atribuídas e pendentes (tabela `advbox_tasks`, filtrado por `assigned_users`)

**Para OPERACIONAL (advogados, estagiários, paralegal):**

- Movimentações de processos do dia anterior  em quw cada colaborador seja responsável (via API ADVBox ou cache local)
- Tarefas com prazo próximo (próximos 3 dias)
- Tarefas atrasadas

**Para COMERCIAL:**

- Resumo de leads do dia anterior e da semana (tabela `captured_leads`)
- Leads por fonte, campanha
- Total de novos contatos

### 2. Edge Function: `send-immediate-notification-email` (EVOLUÇÃO)

Expandir a função `send-notification-email` existente para incluir novos templates:

- `**new_message**`: Já existe — será acionado imediatamente quando alguém receber uma mensagem
- `**intranet_update**`: Novo template para avisos de melhorias/atualizações da intranet
- `**announcement_urgent**`: Para comunicados marcados como urgentes

### 3. Novos templates de e-mail no `send-notification-email`

- `daily_digest_operacional` — Resumo diário operacional
- `daily_digest_comercial` — Resumo diário comercial
- `daily_digest_geral` — Resumo diário geral (mensagens + avisos)
- `intranet_update` — Notificação de atualização/melhoria da intranet

### 4. Atualização da tabela `email_notification_preferences`

Adicionar novas colunas via migração:

- `notify_daily_digest` (boolean, default true) — Receber resumo diário
- `notify_intranet_updates` (boolean, default true) — Receber avisos de atualizações da intranet

### 5. Atualização do `EmailNotificationSettings.tsx`

Adicionar switches para as novas preferências de notificação.

### 6. Hooks de disparo imediato

- Atualizar o hook `useMessaging` para disparar e-mail ao enviar mensagem
- Criar lógica no `MuralAvisos` para disparar e-mail ao publicar comunicado urgente
- Criar lógica no `SystemUpdatesNotification` para disparar e-mail ao registrar atualização da intranet

### 7. Configuração do pg_cron

Agendar a Edge Function `send-daily-digest` para rodar diariamente às 7:00 (Brasília).

---

## Detalhes Técnicos

### Remetente

- De: `Egg Nunes - Avisos <avisos@intranetagnunes.com.br>`
- Via Resend API (secret `RESEND_API_KEY` já configurada)

### Lógica do Digest Diário (`send-daily-digest`)

1. Buscar todos os perfis ativos/aprovados/não suspensos
2. Para cada usuário, verificar `email_notification_preferences.notify_daily_digest`
3. Determinar cargo/setor do usuário (`profiles.position`)
4. Montar conteúdo personalizado:
  - Buscar mensagens recebidas nas últimas 24h via `messages` + `conversation_participants`
  - Buscar comunicados recentes via `announcements`
  - Buscar tarefas atribuídas via `advbox_tasks` (filtro por `assigned_users`)
  - Se comercial: buscar leads via `captured_leads` (últimas 24h e última semana)
  - Se operacional: buscar movimentações via API ADVBox ou cache
5. Se não houver nada relevante, NÃO enviar e-mail (evitar spam)
6. Enviar via Resend com template HTML formatado

### Proteções

- Verificar `is_active`, `is_suspended`, `approval_status` antes de enviar
- Respeitar preferências individuais do usuário
- Rate limiting: enviar com delay de 200ms entre e-mails (Resend free tier)
- Não enviar digest vazio (sem conteúdo relevante)

---

## Arquivos Afetados


| Arquivo                                               | Ação                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `supabase/functions/send-daily-digest/index.ts`       | **Criar** — Edge function do resumo diário                        |
| `supabase/functions/send-notification-email/index.ts` | **Editar** — Adicionar templates + mudar remetente                |
| `src/components/EmailNotificationSettings.tsx`        | **Editar** — Adicionar novas preferências                         |
| `src/hooks/useEmailNotification.tsx`                  | **Editar** — Adicionar funções de conveniência                    |
| `src/pages/MuralAvisos.tsx`                           | **Editar** — Disparar e-mail ao publicar comunicado               |
| Migração DB                                           | **Criar** — Adicionar colunas em `email_notification_preferences` |
| pg_cron                                               | **Configurar** — Agendar digest diário                            |
