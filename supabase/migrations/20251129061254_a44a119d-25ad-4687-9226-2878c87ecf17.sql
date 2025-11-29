-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_post_notification UNIQUE (user_id, post_id)
);

-- Habilitar RLS
ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.forum_notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Sistema pode criar notificações"
ON public.forum_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários podem marcar suas notificações como lidas"
ON public.forum_notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas próprias notificações"
ON public.forum_notifications
FOR DELETE
USING (user_id = auth.uid());

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_forum_notifications_user_id ON public.forum_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_notifications_read ON public.forum_notifications(user_id, read);

-- Adicionar trigger para atualizar last_post_at quando um post é criado
CREATE OR REPLACE FUNCTION update_topic_last_post()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.forum_topics
  SET last_post_at = NEW.created_at
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_topic_last_post_trigger
AFTER INSERT ON public.forum_posts
FOR EACH ROW
EXECUTE FUNCTION update_topic_last_post();