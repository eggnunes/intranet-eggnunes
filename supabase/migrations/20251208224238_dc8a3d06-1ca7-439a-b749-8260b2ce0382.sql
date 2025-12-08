-- Make user_id nullable in success_fee_templates to allow default templates
ALTER TABLE public.success_fee_templates 
ALTER COLUMN user_id DROP NOT NULL;