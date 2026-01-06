-- Tabela para armazenar logs de eventos do webhook Asaas
CREATE TABLE public.asaas_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  installment_id TEXT,
  customer_id TEXT,
  subscription_id TEXT,
  transfer_id TEXT,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_asaas_webhook_event_type ON public.asaas_webhook_events(event_type);
CREATE INDEX idx_asaas_webhook_payment_id ON public.asaas_webhook_events(payment_id);
CREATE INDEX idx_asaas_webhook_processed ON public.asaas_webhook_events(processed);
CREATE INDEX idx_asaas_webhook_created_at ON public.asaas_webhook_events(created_at DESC);

-- Tabela para vincular pagamentos do Asaas com lançamentos do sistema
CREATE TABLE public.asaas_payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_payment_id TEXT NOT NULL,
  asaas_installment_id TEXT,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  asaas_customer_id TEXT,
  customer_name TEXT,
  value NUMERIC(12,2),
  due_date DATE,
  payment_date DATE,
  status TEXT,
  billing_type TEXT,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX idx_asaas_payment_links_payment_id ON public.asaas_payment_links(asaas_payment_id);
CREATE INDEX idx_asaas_payment_links_lancamento ON public.asaas_payment_links(lancamento_id);
CREATE INDEX idx_asaas_payment_links_status ON public.asaas_payment_links(status);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_asaas_payment_links_updated_at
BEFORE UPDATE ON public.asaas_payment_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_payment_links ENABLE ROW LEVEL SECURITY;

-- Políticas para admin_permissions (usuários autenticados com acesso financeiro)
CREATE POLICY "Users with financial access can view webhook events"
ON public.asaas_webhook_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.admin_user_id = auth.uid()
    AND (ap.perm_financial = 'edit' OR ap.perm_financial = 'view')
  )
);

CREATE POLICY "Users with financial access can view payment links"
ON public.asaas_payment_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.admin_user_id = auth.uid()
    AND (ap.perm_financial = 'edit' OR ap.perm_financial = 'view')
  )
);

CREATE POLICY "Users with financial edit access can manage payment links"
ON public.asaas_payment_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.admin_user_id = auth.uid()
    AND ap.perm_financial = 'edit'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.admin_user_id = auth.uid()
    AND ap.perm_financial = 'edit'
  )
);

-- Políticas para service role (edge functions)
CREATE POLICY "Service role can manage webhook events"
ON public.asaas_webhook_events
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');