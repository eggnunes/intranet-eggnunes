
-- Tabela para mapear URLs de landing pages a produtos
CREATE TABLE public.landing_page_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url_pattern TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(url_pattern)
);

-- Adicionar coluna de produto nos leads capturados
ALTER TABLE public.captured_leads ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Enable RLS
ALTER TABLE public.landing_page_product_mappings ENABLE ROW LEVEL SECURITY;

-- Policies - apenas sócios podem gerenciar
CREATE POLICY "Sócios podem gerenciar mapeamentos" 
ON public.landing_page_product_mappings 
FOR ALL 
USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários autenticados podem ver mapeamentos" 
ON public.landing_page_product_mappings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
