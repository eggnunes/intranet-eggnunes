-- Create table for initial fee templates (if not exists)
CREATE TABLE IF NOT EXISTS public.initial_fee_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  tipo_honorarios TEXT NOT NULL DEFAULT 'avista',
  valor_total TEXT,
  numero_parcelas TEXT,
  valor_parcela TEXT,
  tem_entrada BOOLEAN DEFAULT false,
  valor_entrada TEXT,
  forma_pagamento TEXT DEFAULT 'pix',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.initial_fee_templates ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own and default templates" ON public.initial_fee_templates;
CREATE POLICY "Users can view own and default templates"
ON public.initial_fee_templates
FOR SELECT
USING (user_id = auth.uid() OR is_default = true);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.initial_fee_templates;
CREATE POLICY "Users can create their own templates"
ON public.initial_fee_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.initial_fee_templates;
CREATE POLICY "Users can update their own templates"
ON public.initial_fee_templates
FOR UPDATE
USING (auth.uid() = user_id AND (is_default = false OR is_default IS NULL));

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.initial_fee_templates;
CREATE POLICY "Users can delete their own templates"
ON public.initial_fee_templates
FOR DELETE
USING (auth.uid() = user_id AND (is_default = false OR is_default IS NULL));

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_initial_fee_templates_updated_at ON public.initial_fee_templates;
CREATE TRIGGER update_initial_fee_templates_updated_at
BEFORE UPDATE ON public.initial_fee_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();