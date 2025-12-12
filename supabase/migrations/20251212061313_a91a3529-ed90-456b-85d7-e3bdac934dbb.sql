-- =============================================
-- CRM Analytics & Notifications System
-- =============================================

-- 1. Table for lead scoring rules (customizable scoring)
CREATE TABLE public.crm_lead_scoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  field_name TEXT NOT NULL, -- e.g., 'utm_source', 'product_name', 'traffic_source'
  field_value TEXT NOT NULL, -- e.g., 'google', 'facebook'
  operator TEXT NOT NULL DEFAULT 'equals', -- 'equals', 'contains', 'not_equals'
  points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Table for CRM notifications/alerts
CREATE TABLE public.crm_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'stale_deal', 'follow_up', 'close_date_near', 'deal_lost', 'deal_won'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Table for follow-up reminders
CREATE TABLE public.crm_follow_up_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Table for stale deal alert configuration
CREATE TABLE public.crm_alert_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stale_deal_days INTEGER DEFAULT 7, -- Alert after X days without activity
  close_date_warning_days INTEGER DEFAULT 3, -- Alert X days before expected close
  enable_stale_alerts BOOLEAN DEFAULT true,
  enable_close_date_alerts BOOLEAN DEFAULT true,
  enable_follow_up_alerts BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Table for WhatsApp conversation logs (ChatGuru integration)
CREATE TABLE public.crm_whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  message_text TEXT,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'audio', 'document'
  chatguru_message_id TEXT,
  sent_by UUID, -- User who sent (for outbound)
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.crm_lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_follow_up_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_lead_scoring_rules
CREATE POLICY "Usuários com permissão podem ver regras de scoring"
  ON public.crm_lead_scoring_rules FOR SELECT
  USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Sócios podem gerenciar regras de scoring"
  ON public.crm_lead_scoring_rules FOR ALL
  USING (is_socio_or_rafael(auth.uid()));

-- RLS Policies for crm_notifications
CREATE POLICY "Usuários podem ver suas próprias notificações"
  ON public.crm_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Sistema pode criar notificações"
  ON public.crm_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar suas notificações"
  ON public.crm_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas notificações"
  ON public.crm_notifications FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for crm_follow_up_reminders
CREATE POLICY "Usuários podem ver seus próprios lembretes"
  ON public.crm_follow_up_reminders FOR SELECT
  USING (user_id = auth.uid() OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários com permissão edit podem criar lembretes"
  ON public.crm_follow_up_reminders FOR INSERT
  WITH CHECK (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

CREATE POLICY "Usuários podem atualizar seus lembretes"
  ON public.crm_follow_up_reminders FOR UPDATE
  USING (user_id = auth.uid() OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários podem deletar seus lembretes"
  ON public.crm_follow_up_reminders FOR DELETE
  USING (user_id = auth.uid() OR is_socio_or_rafael(auth.uid()));

-- RLS Policies for crm_alert_settings
CREATE POLICY "Usuários com permissão podem ver configurações de alertas"
  ON public.crm_alert_settings FOR SELECT
  USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Sócios podem gerenciar configurações de alertas"
  ON public.crm_alert_settings FOR ALL
  USING (is_socio_or_rafael(auth.uid()));

-- RLS Policies for crm_whatsapp_logs
CREATE POLICY "Usuários com permissão podem ver logs WhatsApp"
  ON public.crm_whatsapp_logs FOR SELECT
  USING (get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit'));

CREATE POLICY "Usuários com permissão edit podem criar logs"
  ON public.crm_whatsapp_logs FOR INSERT
  WITH CHECK (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

-- Create indexes for performance
CREATE INDEX idx_crm_notifications_user_id ON public.crm_notifications(user_id);
CREATE INDEX idx_crm_notifications_deal_id ON public.crm_notifications(deal_id);
CREATE INDEX idx_crm_notifications_is_read ON public.crm_notifications(is_read);
CREATE INDEX idx_crm_follow_up_reminders_user_id ON public.crm_follow_up_reminders(user_id);
CREATE INDEX idx_crm_follow_up_reminders_reminder_date ON public.crm_follow_up_reminders(reminder_date);
CREATE INDEX idx_crm_whatsapp_logs_contact_id ON public.crm_whatsapp_logs(contact_id);
CREATE INDEX idx_crm_whatsapp_logs_phone_number ON public.crm_whatsapp_logs(phone_number);

-- Insert default alert settings
INSERT INTO public.crm_alert_settings (stale_deal_days, close_date_warning_days) 
VALUES (7, 3);

-- Create update triggers
CREATE TRIGGER update_crm_lead_scoring_rules_updated_at
  BEFORE UPDATE ON public.crm_lead_scoring_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_follow_up_reminders_updated_at
  BEFORE UPDATE ON public.crm_follow_up_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_alert_settings_updated_at
  BEFORE UPDATE ON public.crm_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();