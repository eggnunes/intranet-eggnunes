
-- Regras de automação (gatilho → ação)
CREATE TABLE public.crm_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
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
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de execuções
CREATE TABLE public.crm_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.crm_automation_rules(id) ON DELETE CASCADE,
  trigger_entity_type TEXT,
  trigger_entity_id UUID,
  action_result JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users manage automation rules" ON public.crm_automation_rules FOR ALL TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved users manage lead lists" ON public.crm_lead_lists FOR ALL TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved users view automation log" ON public.crm_automation_log FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "System inserts automation log" ON public.crm_automation_log FOR INSERT TO authenticated WITH CHECK (true);
