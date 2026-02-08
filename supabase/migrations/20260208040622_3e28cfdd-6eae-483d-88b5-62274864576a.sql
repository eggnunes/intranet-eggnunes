
-- Create table for Z-API message logs
CREATE TABLE public.zapi_messages_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'aviso',
  status TEXT NOT NULL DEFAULT 'pending',
  zapi_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapi_messages_log ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view logs
CREATE POLICY "Authenticated users can view Z-API logs"
  ON public.zapi_messages_log
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert logs (edge functions use service role)
CREATE POLICY "Service role can insert Z-API logs"
  ON public.zapi_messages_log
  FOR INSERT
  WITH CHECK (true);

-- Create index for querying by customer and date
CREATE INDEX idx_zapi_messages_customer ON public.zapi_messages_log(customer_id);
CREATE INDEX idx_zapi_messages_sent_at ON public.zapi_messages_log(sent_at DESC);
CREATE INDEX idx_zapi_messages_type ON public.zapi_messages_log(message_type);
