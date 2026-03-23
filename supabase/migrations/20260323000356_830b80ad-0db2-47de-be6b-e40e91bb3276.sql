ALTER TABLE public.email_notification_preferences 
ADD COLUMN IF NOT EXISTS notify_daily_digest boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_intranet_updates boolean DEFAULT true;