
-- Templates para parte contrária
CREATE TABLE public.contra_partida_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Templates para objeto do contrato
CREATE TABLE public.objeto_contrato_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Associação de templates por produto
CREATE TABLE public.product_template_associations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  contra_partida_template_id UUID REFERENCES public.contra_partida_templates(id) ON DELETE SET NULL,
  objeto_contrato_template_id UUID REFERENCES public.objeto_contrato_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_name)
);

-- Enable RLS
ALTER TABLE public.contra_partida_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objeto_contrato_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template_associations ENABLE ROW LEVEL SECURITY;

-- RLS policies for contra_partida_templates
CREATE POLICY "Users can view own and default templates" ON public.contra_partida_templates
  FOR SELECT USING ((user_id = auth.uid()) OR (is_default = true));

CREATE POLICY "Users can create their own templates" ON public.contra_partida_templates
  FOR INSERT WITH CHECK ((auth.uid() = user_id) OR (has_role(auth.uid(), 'admin'::app_role) AND is_default = true AND user_id IS NULL));

CREATE POLICY "Users can update their own templates" ON public.contra_partida_templates
  FOR UPDATE USING (((auth.uid() = user_id) AND (is_default = false OR is_default IS NULL)) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own templates" ON public.contra_partida_templates
  FOR DELETE USING (((auth.uid() = user_id) AND (is_default = false OR is_default IS NULL)) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for objeto_contrato_templates
CREATE POLICY "Users can view own and default templates" ON public.objeto_contrato_templates
  FOR SELECT USING ((user_id = auth.uid()) OR (is_default = true));

CREATE POLICY "Users can create their own templates" ON public.objeto_contrato_templates
  FOR INSERT WITH CHECK ((auth.uid() = user_id) OR (has_role(auth.uid(), 'admin'::app_role) AND is_default = true AND user_id IS NULL));

CREATE POLICY "Users can update their own templates" ON public.objeto_contrato_templates
  FOR UPDATE USING (((auth.uid() = user_id) AND (is_default = false OR is_default IS NULL)) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own templates" ON public.objeto_contrato_templates
  FOR DELETE USING (((auth.uid() = user_id) AND (is_default = false OR is_default IS NULL)) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for product_template_associations
CREATE POLICY "Users can view their own associations" ON public.product_template_associations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own associations" ON public.product_template_associations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own associations" ON public.product_template_associations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own associations" ON public.product_template_associations
  FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_contra_partida_templates_updated_at
  BEFORE UPDATE ON public.contra_partida_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_objeto_contrato_templates_updated_at
  BEFORE UPDATE ON public.objeto_contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_template_associations_updated_at
  BEFORE UPDATE ON public.product_template_associations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
