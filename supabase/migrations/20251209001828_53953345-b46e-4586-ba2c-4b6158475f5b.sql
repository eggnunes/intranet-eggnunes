-- Criar tabela de notificações individuais
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, error, task, contract
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT, -- URL opcional para ação
  metadata JSONB, -- Dados adicionais (ex: contract_id, task_id)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.user_notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar suas próprias notificações"
ON public.user_notifications
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas próprias notificações"
ON public.user_notifications
FOR DELETE
USING (user_id = auth.uid());

-- Sistema pode criar notificações para qualquer usuário
CREATE POLICY "Sistema pode criar notificações"
ON public.user_notifications
FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_is_read ON public.user_notifications(user_id, is_read);
CREATE INDEX idx_user_notifications_created_at ON public.user_notifications(created_at DESC);

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;