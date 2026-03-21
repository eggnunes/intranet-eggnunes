-- Table to map WhatsApp business phone numbers to products
CREATE TABLE public.whatsapp_product_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_product_numbers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated approved users to read
CREATE POLICY "Approved users can view whatsapp_product_numbers"
  ON public.whatsapp_product_numbers FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

-- Allow admins to manage
CREATE POLICY "Admins can manage whatsapp_product_numbers"
  ON public.whatsapp_product_numbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert the 3 known numbers
INSERT INTO public.whatsapp_product_numbers (phone_number, product_name, description) VALUES
  ('553184344364', 'Férias Prêmio', 'Número Click-to-WhatsApp para campanhas de Férias Prêmio'),
  ('553132268742', 'Imposto de Renda', 'Número Click-to-WhatsApp para campanhas de IR / Isenção IR'),
  ('5511998802573', 'Imobiliário', 'Número Click-to-WhatsApp para campanhas de Direito Imobiliário');

-- Add whatsapp_business_phone column to captured_leads to track which number received the message
ALTER TABLE public.captured_leads ADD COLUMN IF NOT EXISTS whatsapp_business_phone TEXT;