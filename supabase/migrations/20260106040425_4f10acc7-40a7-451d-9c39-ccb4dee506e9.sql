-- Tabela para armazenar notas fiscais do Asaas
CREATE TABLE public.asaas_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_invoice_id TEXT NOT NULL UNIQUE,
  asaas_payment_id TEXT,
  customer_id TEXT,
  customer_name TEXT,
  value NUMERIC,
  status TEXT,
  service_description TEXT,
  observations TEXT,
  external_reference TEXT,
  invoice_number TEXT,
  invoice_url TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  scheduled_date DATE,
  authorized_date TIMESTAMP WITH TIME ZONE,
  canceled_date TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar transferências do Asaas
CREATE TABLE public.asaas_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_transfer_id TEXT NOT NULL UNIQUE,
  value NUMERIC NOT NULL,
  net_value NUMERIC,
  transfer_fee NUMERIC,
  status TEXT NOT NULL,
  transfer_type TEXT,
  bank_account_id TEXT,
  operation_type TEXT,
  description TEXT,
  scheduled_date DATE,
  transaction_receipt_url TEXT,
  effective_date DATE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar movimentações internas do Asaas
CREATE TABLE public.asaas_internal_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_transfer_id TEXT NOT NULL UNIQUE,
  transfer_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  status TEXT,
  from_wallet_id TEXT,
  to_wallet_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para alertas de tokens/chaves de API do Asaas
CREATE TABLE public.asaas_api_key_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  api_key_id TEXT,
  api_key_name TEXT,
  expiration_date TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_asaas_invoices_status ON public.asaas_invoices(status);
CREATE INDEX idx_asaas_invoices_customer_id ON public.asaas_invoices(customer_id);
CREATE INDEX idx_asaas_transfers_status ON public.asaas_transfers(status);
CREATE INDEX idx_asaas_internal_transfers_type ON public.asaas_internal_transfers(transfer_type);
CREATE INDEX idx_asaas_api_key_alerts_is_read ON public.asaas_api_key_alerts(is_read);

-- Enable RLS
ALTER TABLE public.asaas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_internal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_api_key_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Permitir leitura para usuários autenticados
CREATE POLICY "Authenticated users can view asaas_invoices" ON public.asaas_invoices FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view asaas_transfers" ON public.asaas_transfers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view asaas_internal_transfers" ON public.asaas_internal_transfers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view asaas_api_key_alerts" ON public.asaas_api_key_alerts FOR SELECT USING (auth.uid() IS NOT NULL);

-- Permitir inserção/atualização via service role (webhook)
CREATE POLICY "Service role can manage asaas_invoices" ON public.asaas_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage asaas_transfers" ON public.asaas_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage asaas_internal_transfers" ON public.asaas_internal_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage asaas_api_key_alerts" ON public.asaas_api_key_alerts FOR ALL USING (true) WITH CHECK (true);

-- Atualizar tabela de webhook_events para incluir mais tipos
ALTER TABLE public.asaas_webhook_events ADD COLUMN IF NOT EXISTS invoice_id TEXT;