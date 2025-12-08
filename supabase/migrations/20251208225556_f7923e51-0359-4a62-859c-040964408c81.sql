-- Adicionar campo forma_pagamento_entrada para suportar pagamento separado para entrada
ALTER TABLE public.initial_fee_templates 
ADD COLUMN IF NOT EXISTS forma_pagamento_entrada text DEFAULT 'pix';

-- Adicionar campo para forma de pagamento das parcelas separado
ALTER TABLE public.initial_fee_templates 
ADD COLUMN IF NOT EXISTS forma_pagamento_parcelas text;

-- Atualizar descrição de templates existentes (adicionar campo opcional)
ALTER TABLE public.initial_fee_templates 
ADD COLUMN IF NOT EXISTS descricao text;

-- Permitir que admins possam deletar templates padrão
-- Atualizar a policy de delete para permitir admins deletarem qualquer template
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.initial_fee_templates;

CREATE POLICY "Users can delete their own templates or admin can delete any" 
ON public.initial_fee_templates 
FOR DELETE 
USING (
  ((auth.uid() = user_id) AND ((is_default = false) OR (is_default IS NULL)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir admins atualizarem templates padrão
DROP POLICY IF EXISTS "Users can update their own templates" ON public.initial_fee_templates;

CREATE POLICY "Users can update their own templates or admin can update any" 
ON public.initial_fee_templates 
FOR UPDATE 
USING (
  ((auth.uid() = user_id) AND ((is_default = false) OR (is_default IS NULL)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir admins criarem templates padrão (user_id = null, is_default = true)
DROP POLICY IF EXISTS "Users can create their own templates" ON public.initial_fee_templates;

CREATE POLICY "Users can create their own templates or admin can create default" 
ON public.initial_fee_templates 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id)
  OR (has_role(auth.uid(), 'admin'::app_role) AND is_default = true AND user_id IS NULL)
);

-- Fazer o mesmo para success_fee_templates
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.success_fee_templates;

CREATE POLICY "Users can delete their own templates or admin can delete any" 
ON public.success_fee_templates 
FOR DELETE 
USING (
  ((auth.uid() = user_id) AND ((is_default = false) OR (is_default IS NULL)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.success_fee_templates;

CREATE POLICY "Users can update their own templates or admin can update any" 
ON public.success_fee_templates 
FOR UPDATE 
USING (
  ((auth.uid() = user_id) AND ((is_default = false) OR (is_default IS NULL)))
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.success_fee_templates;

CREATE POLICY "Users can create their own templates or admin can create default" 
ON public.success_fee_templates 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id)
  OR (has_role(auth.uid(), 'admin'::app_role) AND is_default = true AND user_id IS NULL)
);