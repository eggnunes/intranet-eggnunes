
-- Criar tabela advbox_customers para cache local
CREATE TABLE public.advbox_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advbox_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_id TEXT,
  cpf TEXT,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  birthday DATE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_advbox_customers_name ON public.advbox_customers USING gin (to_tsvector('portuguese', name));
CREATE INDEX idx_advbox_customers_tax_id ON public.advbox_customers (tax_id) WHERE tax_id IS NOT NULL;
CREATE INDEX idx_advbox_customers_cpf ON public.advbox_customers (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_advbox_customers_name_lower ON public.advbox_customers (lower(name));

-- RLS
ALTER TABLE public.advbox_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler advbox_customers"
ON public.advbox_customers
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role pode inserir/atualizar advbox_customers"
ON public.advbox_customers
FOR ALL
USING (true)
WITH CHECK (true);
