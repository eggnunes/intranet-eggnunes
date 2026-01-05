-- Tabela para registro de contratos no financeiro
CREATE TABLE public.fin_contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  client_cpf TEXT,
  client_email TEXT,
  client_phone TEXT,
  product_name TEXT NOT NULL,
  objeto_contrato TEXT,
  valor_total DECIMAL(15,2),
  forma_pagamento TEXT,
  numero_parcelas INTEGER,
  valor_parcela DECIMAL(15,2),
  valor_entrada DECIMAL(15,2),
  data_vencimento TEXT,
  tem_honorarios_exito BOOLEAN DEFAULT false,
  descricao_exito TEXT,
  advbox_customer_id TEXT,
  advbox_lawsuit_id TEXT,
  advbox_sync_status TEXT DEFAULT 'pending', -- pending, synced, error
  advbox_sync_error TEXT,
  qualification TEXT,
  contract_file_url TEXT,
  status TEXT DEFAULT 'ativo', -- ativo, cancelado, finalizado
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fin_contratos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários aprovados podem visualizar contratos"
  ON public.fin_contratos
  FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem criar contratos"
  ON public.fin_contratos
  FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem atualizar contratos"
  ON public.fin_contratos
  FOR UPDATE
  USING (is_approved(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_fin_contratos_updated_at
  BEFORE UPDATE ON public.fin_contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_fin_contratos_client_id ON public.fin_contratos(client_id);
CREATE INDEX idx_fin_contratos_status ON public.fin_contratos(status);
CREATE INDEX idx_fin_contratos_advbox_sync ON public.fin_contratos(advbox_sync_status);
CREATE INDEX idx_fin_contratos_created_at ON public.fin_contratos(created_at DESC);