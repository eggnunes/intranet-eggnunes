
-- Table to track boleto reminder notifications to avoid duplicates
CREATE TABLE public.boleto_reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_payment_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  reminder_type TEXT NOT NULL, -- 'before_10', 'before_5', 'due_date', 'after_2', 'after_5', 'after_10'
  due_date DATE,
  value NUMERIC,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  zapi_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index to quickly check if a reminder was already sent
CREATE UNIQUE INDEX idx_boleto_reminder_unique ON public.boleto_reminder_log (asaas_payment_id, reminder_type);

-- Index for querying by date
CREATE INDEX idx_boleto_reminder_sent_at ON public.boleto_reminder_log (sent_at);

-- Enable RLS
ALTER TABLE public.boleto_reminder_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role key)
-- Admin users can view the log
CREATE POLICY "Admins can view boleto reminder logs"
ON public.boleto_reminder_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
