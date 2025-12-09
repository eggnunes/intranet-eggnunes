-- Fix user_notifications INSERT policy - restrict to service_role only
DROP POLICY IF EXISTS "Sistema pode criar notificações" ON public.user_notifications;

-- Only service_role (backend/edge functions) can create notifications
-- This prevents users from creating fake notifications for other users
CREATE POLICY "Only service role can create notifications"
ON public.user_notifications 
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow admins to create notifications for any user (optional, for admin panel)
CREATE POLICY "Admins can create notifications for any user"
ON public.user_notifications 
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);