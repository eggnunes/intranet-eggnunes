-- Create table to log birthday messages sent via ChatGuru
CREATE TABLE IF NOT EXISTS public.chatguru_birthday_messages_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent',
  chatguru_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_chatguru_birthday_log_sent_at ON public.chatguru_birthday_messages_log(sent_at);
CREATE INDEX idx_chatguru_birthday_log_customer_id ON public.chatguru_birthday_messages_log(customer_id);

-- Enable RLS
ALTER TABLE public.chatguru_birthday_messages_log ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view all birthday message logs"
  ON public.chatguru_birthday_messages_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;