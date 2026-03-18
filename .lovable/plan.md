

# Módulo de Automação e Segmentação de Leads (MarketingAutomation)

## Resumo

Criar duas tabelas novas (`crm_automation_rules` para regras de automação e `crm_lead_lists` para listas dinâmicas), um componente frontend `MarketingAutomation.tsx` com interface completa, e uma Edge Function `process-crm-automation` que processa regras quando gatilhos são acionados.

## 1. Migração — Duas novas tabelas

```sql
-- Regras de automação (gatilho → ação)
CREATE TABLE public.crm_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'lead_created', 'deal_stage_changed', 'score_reached', 'deal_won', 'deal_lost'
  trigger_config JSONB DEFAULT '{}'::jsonb, -- ex: { "stage_id": "xxx", "min_score": 50 }
  action_type TEXT NOT NULL, -- 'send_whatsapp', 'create_task', 'change_status', 'update_score', 'notify_owner'
  action_config JSONB DEFAULT '{}'::jsonb, -- ex: { "message_template": "...", "task_title": "..." }
  is_active BOOLEAN DEFAULT true,
  executions_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Listas dinâmicas de leads
CREATE TABLE public.crm_lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "state": "MG", "days_ago": 30, "min_score": 0 }
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de execuções
CREATE TABLE public.crm_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.crm_automation_rules(id) ON DELETE CASCADE,
  trigger_entity_type TEXT, -- 'contact', 'deal'
  trigger_entity_id UUID,
  action_result JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_log ENABLE ROW LEVEL SECURITY;

-- RLS: approved users can manage
CREATE POLICY "Approved users manage automation rules" ON public.crm_automation_rules FOR ALL TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved users manage lead lists" ON public.crm_lead_lists FOR ALL TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved users view automation log" ON public.crm_automation_log FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "System inserts automation log" ON public.crm_automation_log FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Criar `src/components/crm/MarketingAutomation.tsx`

Componente com 3 abas:

**Aba "Regras de Automação":**
- Lista de regras com nome, gatilho, ação, status (ativo/inativo), contagem de execuções
- Toggle ativo/inativo por regra
- Dialog de criação/edição com:
  - Nome da regra
  - Select de Gatilho: Lead criado, Deal movido para etapa X (mostra select de etapas), Score atingiu Y (input numérico), Deal ganho, Deal perdido
  - Select de Ação: Enviar WhatsApp (input template), Criar tarefa (input título + tipo), Mudar status, Notificar responsável
  - Configurações dinâmicas baseadas no tipo selecionado

**Aba "Listas Dinâmicas":**
- Lista de listas salvas com nome, descrição, contagem de leads que correspondem
- Dialog de criação com filtros: Estado (select), Cidade (input), Período (últimos X dias), Score mínimo, Origem/UTM, Empresa
- Preview dos leads que correspondem aos filtros antes de salvar
- Botão "Ver Leads" que expande mostrando a lista filtrada

**Aba "Log de Execuções":**
- Tabela com histórico: data, regra, entidade afetada, resultado (sucesso/erro)
- Filtro por regra e período

## 3. Edge Function `process-crm-automation`

- Recebe `{ trigger_type, entity_id, entity_data }` no body
- Busca regras ativas que correspondem ao `trigger_type`
- Para cada regra, verifica `trigger_config` (ex: stage_id correto, score >= min_score)
- Executa a ação configurada:
  - `send_whatsapp`: chama `zapi-send-message` internamente
  - `create_task`: insere em `crm_activities`
  - `notify_owner`: insere em `user_notifications`
- Registra execução em `crm_automation_log`
- `verify_jwt = true` no config.toml

## 4. Integrar no CRMDashboard

- Importar `MarketingAutomation`
- Adicionar aba "Automação" com ícone `Zap` entre "WhatsApp" e "Config"
- `<TabsContent value="automation"><MarketingAutomation /></TabsContent>`

## 5. Atualizar `src/components/crm/index.ts`

- Exportar `MarketingAutomation`

## Arquivos

1. **Migração SQL** — 3 tabelas + RLS
2. **`src/components/crm/MarketingAutomation.tsx`** (novo)
3. **`supabase/functions/process-crm-automation/index.ts`** (novo)
4. **`supabase/config.toml`** — adicionar entry para nova function
5. **`src/components/crm/CRMDashboard.tsx`** — nova aba
6. **`src/components/crm/index.ts`** — exportar

