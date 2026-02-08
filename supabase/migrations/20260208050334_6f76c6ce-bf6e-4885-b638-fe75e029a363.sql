
-- Tabela para armazenar TODOS os eventos de webhook da Z-API
CREATE TABLE public.zapi_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  phone TEXT,
  message_id TEXT,
  zaap_id TEXT,
  is_group BOOLEAN DEFAULT false,
  chat_name TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  is_from_me BOOLEAN DEFAULT false,
  moment_type TEXT,
  status TEXT,
  broadcast BOOLEAN DEFAULT false,
  message_type TEXT,
  message_text TEXT,
  caption TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  thumbnail_url TEXT,
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  quoted_message_id TEXT,
  reaction_emoji TEXT,
  connected BOOLEAN,
  battery_level INTEGER,
  is_charging BOOLEAN,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_zapi_webhook_events_event_type ON public.zapi_webhook_events(event_type);
CREATE INDEX idx_zapi_webhook_events_phone ON public.zapi_webhook_events(phone);
CREATE INDEX idx_zapi_webhook_events_received_at ON public.zapi_webhook_events(received_at DESC);
CREATE INDEX idx_zapi_webhook_events_message_id ON public.zapi_webhook_events(message_id);
CREATE INDEX idx_zapi_webhook_events_is_from_me ON public.zapi_webhook_events(is_from_me);
CREATE INDEX idx_zapi_webhook_events_status ON public.zapi_webhook_events(status);

-- Enable RLS
ALTER TABLE public.zapi_webhook_events ENABLE ROW LEVEL SECURITY;

-- Apenas admins autenticados podem consultar (leitura)
CREATE POLICY "Authenticated users can read webhook events"
  ON public.zapi_webhook_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Inserção via service role (edge function)
CREATE POLICY "Service role can insert webhook events"
  ON public.zapi_webhook_events
  FOR INSERT
  WITH CHECK (true);

-- Service role can update (para marcar como processed)
CREATE POLICY "Service role can update webhook events"
  ON public.zapi_webhook_events
  FOR UPDATE
  USING (true);
