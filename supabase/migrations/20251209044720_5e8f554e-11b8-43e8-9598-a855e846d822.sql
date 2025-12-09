-- Fix: Drop the overly permissive INSERT policy on user_notifications
-- The "Only service role can create notifications" policy has WITH CHECK: true
-- which allows ANY authenticated user to create notifications for ANY other user

DROP POLICY IF EXISTS "Only service role can create notifications" ON public.user_notifications;