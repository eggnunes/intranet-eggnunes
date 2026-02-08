
-- =============================================
-- WhatsApp Avisos - Tabelas do Sistema
-- =============================================

-- 1. Conversas
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

-- 2. Mensagens
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  zapi_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by UUID,
  quoted_message_id UUID REFERENCES public.whatsapp_messages(id),
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_zapi_id ON public.whatsapp_messages(zapi_message_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- 3. Mensagens Agendadas
CREATE TABLE public.whatsapp_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scheduled whatsapp messages"
  ON public.whatsapp_scheduled_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert scheduled whatsapp messages"
  ON public.whatsapp_scheduled_messages FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update scheduled whatsapp messages"
  ON public.whatsapp_scheduled_messages FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_whatsapp_scheduled_pending ON public.whatsapp_scheduled_messages(scheduled_at) WHERE status = 'pending';

-- 4. Templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shortcut TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  created_by UUID NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shared or own templates"
  ON public.whatsapp_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_shared = true OR created_by = auth.uid()));

CREATE POLICY "Authenticated users can insert templates"
  ON public.whatsapp_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own templates"
  ON public.whatsapp_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own templates"
  ON public.whatsapp_templates FOR DELETE
  USING (auth.uid() = created_by);

CREATE INDEX idx_whatsapp_templates_shortcut ON public.whatsapp_templates(shortcut);

-- Trigger para updated_at nas conversas
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at nos templates
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
