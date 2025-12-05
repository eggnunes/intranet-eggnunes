-- Fix advbox_settings SELECT policy to only allow approved users
DROP POLICY IF EXISTS "Todos podem ver configurações do Advbox" ON public.advbox_settings;

CREATE POLICY "Usuários aprovados podem ver configurações do Advbox"
ON public.advbox_settings
FOR SELECT
TO authenticated
USING (is_approved(auth.uid()));

-- Fix forum_notifications INSERT policy to validate the mentioned_by field
DROP POLICY IF EXISTS "Sistema pode criar notificações" ON public.forum_notifications;

CREATE POLICY "Usuários aprovados podem criar notificações de menção"
ON public.forum_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  is_approved(auth.uid()) AND 
  mentioned_by = auth.uid()
);