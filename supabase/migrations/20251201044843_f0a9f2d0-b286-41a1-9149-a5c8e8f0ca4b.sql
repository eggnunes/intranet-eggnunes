-- Criar tabela para armazenar exclusões de envio de mensagens para inadimplentes
CREATE TABLE IF NOT EXISTS public.defaulter_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  excluded_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id)
);

-- Habilitar RLS
ALTER TABLE public.defaulter_exclusions ENABLE ROW LEVEL SECURITY;

-- Política para admins visualizarem exclusões
CREATE POLICY "Admins can view all exclusions"
ON public.defaulter_exclusions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins criarem exclusões
CREATE POLICY "Admins can create exclusions"
ON public.defaulter_exclusions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política para admins atualizarem exclusões
CREATE POLICY "Admins can update exclusions"
ON public.defaulter_exclusions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins deletarem exclusões
CREATE POLICY "Admins can delete exclusions"
ON public.defaulter_exclusions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Criar índice para melhor performance
CREATE INDEX idx_defaulter_exclusions_customer_id ON public.defaulter_exclusions(customer_id);

-- Tabela para log de mensagens enviadas
CREATE TABLE IF NOT EXISTS public.defaulter_messages_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  days_overdue INTEGER NOT NULL,
  message_template TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  chatguru_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  sent_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.defaulter_messages_log ENABLE ROW LEVEL SECURITY;

-- Política para admins visualizarem log
CREATE POLICY "Admins can view message log"
ON public.defaulter_messages_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins criarem log
CREATE POLICY "Admins can create message log"
ON public.defaulter_messages_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Criar índice para melhor performance
CREATE INDEX idx_defaulter_messages_log_customer_id ON public.defaulter_messages_log(customer_id);
CREATE INDEX idx_defaulter_messages_log_sent_at ON public.defaulter_messages_log(sent_at);