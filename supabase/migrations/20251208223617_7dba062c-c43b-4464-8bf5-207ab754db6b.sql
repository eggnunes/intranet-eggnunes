-- Add is_default column to success_fee_templates
ALTER TABLE public.success_fee_templates 
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Update success_fee_templates RLS to include default templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.success_fee_templates;
DROP POLICY IF EXISTS "Users can view own and default templates" ON public.success_fee_templates;
CREATE POLICY "Users can view own and default templates"
ON public.success_fee_templates
FOR SELECT
USING (user_id = auth.uid() OR is_default = true);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.success_fee_templates;
DROP POLICY IF EXISTS "Users can update their own non-default templates" ON public.success_fee_templates;
CREATE POLICY "Users can update their own non-default templates"
ON public.success_fee_templates
FOR UPDATE
USING (auth.uid() = user_id AND (is_default = false OR is_default IS NULL));

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.success_fee_templates;
DROP POLICY IF EXISTS "Users can delete their own non-default templates" ON public.success_fee_templates;
CREATE POLICY "Users can delete their own non-default templates"
ON public.success_fee_templates
FOR DELETE
USING (auth.uid() = user_id AND (is_default = false OR is_default IS NULL));