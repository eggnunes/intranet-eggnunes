-- Create table for integration settings
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  test_status TEXT,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Only sócios and Rafael can view/edit integration settings
CREATE POLICY "Socios can view integration settings"
ON public.integration_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (position = 'socio' OR email = 'rafael@eggnunes.com.br')
    AND approval_status = 'approved'
    AND is_active = true
  )
);

CREATE POLICY "Socios can manage integration settings"
ON public.integration_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (position = 'socio' OR email = 'rafael@eggnunes.com.br')
    AND approval_status = 'approved'
    AND is_active = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();