-- Tabela de preferências de notificação por email
CREATE TABLE public.email_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_tasks BOOLEAN DEFAULT true,
  notify_approvals BOOLEAN DEFAULT true,
  notify_financial BOOLEAN DEFAULT true,
  notify_announcements BOOLEAN DEFAULT true,
  notify_vacation BOOLEAN DEFAULT true,
  notify_birthdays BOOLEAN DEFAULT false,
  notify_forum BOOLEAN DEFAULT true,
  notify_messages BOOLEAN DEFAULT true,
  notify_crm BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Log de emails enviados
CREATE TABLE public.email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resend_id TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Políticas para preferências
CREATE POLICY "Users can view own preferences"
ON public.email_notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON public.email_notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON public.email_notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Políticas para log (apenas admins podem ver)
CREATE POLICY "Admins can view email log"
ON public.email_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Índices
CREATE INDEX idx_email_preferences_user ON public.email_notification_preferences(user_id);
CREATE INDEX idx_email_log_user ON public.email_log(user_id);
CREATE INDEX idx_email_log_status ON public.email_log(status);
CREATE INDEX idx_email_log_created ON public.email_log(created_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();