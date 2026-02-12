
-- Create salary history table for tracking cargo salary changes
CREATE TABLE public.rh_cargo_salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo_id UUID NOT NULL REFERENCES public.rh_cargos(id) ON DELETE CASCADE,
  valor_anterior NUMERIC NOT NULL,
  valor_novo NUMERIC NOT NULL,
  alterado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rh_cargo_salary_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view salary history"
ON public.rh_cargo_salary_history FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert salary history"
ON public.rh_cargo_salary_history FOR INSERT
TO authenticated
WITH CHECK (true);
