-- Tabela para configurar quais admins recebem notificações de tarefas
CREATE TABLE public.admin_task_notification_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_overdue_alerts BOOLEAN NOT NULL DEFAULT true,
  receive_due_today_alerts BOOLEAN NOT NULL DEFAULT true,
  receive_due_soon_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_user_id)
);

-- Enable RLS
ALTER TABLE public.admin_task_notification_recipients ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver e gerenciar
CREATE POLICY "Admins podem ver configurações de notificação"
ON public.admin_task_notification_recipients
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar configurações de notificação"
ON public.admin_task_notification_recipients
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar configurações de notificação"
ON public.admin_task_notification_recipients
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar configurações de notificação"
ON public.admin_task_notification_recipients
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_admin_task_notification_recipients_updated_at
BEFORE UPDATE ON public.admin_task_notification_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();