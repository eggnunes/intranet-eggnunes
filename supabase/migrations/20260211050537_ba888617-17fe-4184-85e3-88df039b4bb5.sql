-- Allow authenticated users to insert notifications (needed for caixinha de desabafo, etc.)
DROP POLICY IF EXISTS "Admins can create notifications for any user" ON public.user_notifications;

CREATE POLICY "Authenticated users can create notifications" 
ON public.user_notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);