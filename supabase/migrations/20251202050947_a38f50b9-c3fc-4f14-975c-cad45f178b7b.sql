-- Create table for task notification settings
CREATE TABLE public.task_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notify_days_before INTEGER NOT NULL DEFAULT 3,
  notify_on_due_date BOOLEAN NOT NULL DEFAULT true,
  notify_when_overdue BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT false,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  notification_time TIME NOT NULL DEFAULT '09:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_notification_settings UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.task_notification_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view their own notification settings"
ON public.task_notification_settings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can create their own notification settings"
ON public.task_notification_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update their own notification settings"
ON public.task_notification_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_notification_settings_updated_at
BEFORE UPDATE ON public.task_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();