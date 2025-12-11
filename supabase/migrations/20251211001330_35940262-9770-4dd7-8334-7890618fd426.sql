
-- CRM Settings (controla modo espelho vs independente)
CREATE TABLE public.crm_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_sync_enabled boolean NOT NULL DEFAULT true,
  last_full_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Pipeline/Funil de vendas
CREATE TABLE public.crm_pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_id text UNIQUE,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Etapas do funil
CREATE TABLE public.crm_deal_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  rd_station_id text UNIQUE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Contatos/Leads
CREATE TABLE public.crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_id text UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  job_title text,
  address text,
  city text,
  state text,
  country text,
  website text,
  linkedin text,
  facebook text,
  twitter text,
  birthday date,
  notes text,
  custom_fields jsonb DEFAULT '{}',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  first_conversion text,
  last_conversion text,
  lead_score integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tags para contatos
CREATE TABLE public.crm_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_id text UNIQUE,
  name text NOT NULL UNIQUE,
  color text DEFAULT '#3b82f6',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Relação contatos <-> tags
CREATE TABLE public.crm_contact_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

-- Oportunidades/Deals
CREATE TABLE public.crm_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_id text UNIQUE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_deal_stages(id) ON DELETE SET NULL,
  name text NOT NULL,
  value numeric DEFAULT 0,
  expected_close_date date,
  closed_at timestamp with time zone,
  won boolean,
  loss_reason text,
  owner_id uuid,
  product_name text,
  campaign_name text,
  notes text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Atividades (tarefas, ligações, reuniões, emails)
CREATE TABLE public.crm_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_station_id text UNIQUE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'task', 'call', 'meeting', 'email', 'note', 'whatsapp'
  title text NOT NULL,
  description text,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  completed boolean DEFAULT false,
  owner_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Histórico de movimentações do deal
CREATE TABLE public.crm_deal_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.crm_deal_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES public.crm_deal_stages(id) ON DELETE SET NULL,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Log de sincronização com RD Station
CREATE TABLE public.crm_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL, -- 'full', 'webhook', 'manual'
  entity_type text NOT NULL, -- 'contact', 'deal', 'pipeline', 'stage'
  entity_id text,
  status text NOT NULL, -- 'success', 'error'
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_crm_contacts_email ON public.crm_contacts(email);
CREATE INDEX idx_crm_contacts_phone ON public.crm_contacts(phone);
CREATE INDEX idx_crm_contacts_rd_station_id ON public.crm_contacts(rd_station_id);
CREATE INDEX idx_crm_deals_stage_id ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_contact_id ON public.crm_deals(contact_id);
CREATE INDEX idx_crm_deals_rd_station_id ON public.crm_deals(rd_station_id);
CREATE INDEX idx_crm_activities_contact_id ON public.crm_activities(contact_id);
CREATE INDEX idx_crm_activities_deal_id ON public.crm_activities(deal_id);
CREATE INDEX idx_crm_activities_due_date ON public.crm_activities(due_date);

-- Enable RLS
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Somente sócios e admins com permissão lead_tracking
CREATE POLICY "Admins podem ver configurações CRM" ON public.crm_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Socios podem gerenciar configurações CRM" ON public.crm_settings
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver pipelines" ON public.crm_pipelines
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar pipelines" ON public.crm_pipelines
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver etapas" ON public.crm_deal_stages
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar etapas" ON public.crm_deal_stages
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver contatos" ON public.crm_contacts
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar contatos" ON public.crm_contacts
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver tags" ON public.crm_tags
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar tags" ON public.crm_tags
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver contact_tags" ON public.crm_contact_tags
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar contact_tags" ON public.crm_contact_tags
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver deals" ON public.crm_deals
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar deals" ON public.crm_deals
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver atividades" ON public.crm_activities
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Socios podem gerenciar atividades" ON public.crm_activities
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão podem ver histórico" ON public.crm_deal_history
  FOR SELECT USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Sistema pode inserir histórico" ON public.crm_deal_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins podem ver sync log" ON public.crm_sync_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema pode inserir sync log" ON public.crm_sync_log
  FOR INSERT WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_crm_settings_updated_at BEFORE UPDATE ON public.crm_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_pipelines_updated_at BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deal_stages_updated_at BEFORE UPDATE ON public.crm_deal_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_activities_updated_at BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração inicial
INSERT INTO public.crm_settings (rd_station_sync_enabled) VALUES (true);

-- Enable realtime para deals (para Kanban)
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_activities;
