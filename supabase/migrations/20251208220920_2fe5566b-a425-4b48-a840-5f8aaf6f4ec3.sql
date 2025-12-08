-- Create table to store contract drafts
CREATE TABLE public.contract_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qualification TEXT NOT NULL,
  
  -- Cláusula Primeira
  contra_partida TEXT,
  objeto_contrato TEXT,
  clausula_primeira_gerada TEXT,
  
  -- Cláusula Terceira - Honorários
  tipo_honorarios TEXT DEFAULT 'avista',
  valor_total TEXT,
  numero_parcelas TEXT,
  valor_parcela TEXT,
  tem_entrada BOOLEAN DEFAULT false,
  valor_entrada TEXT,
  forma_pagamento TEXT DEFAULT 'pix',
  data_vencimento TEXT,
  
  -- Honorários Êxito
  tem_honorarios_exito BOOLEAN DEFAULT false,
  descricao_honorarios_exito TEXT,
  clausula_exito_gerada TEXT,
  
  -- Preview text
  contract_preview_text TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_drafts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own drafts"
ON public.contract_drafts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drafts"
ON public.contract_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
ON public.contract_drafts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
ON public.contract_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_contract_drafts_updated_at
BEFORE UPDATE ON public.contract_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();