-- Add tipo column to rh_cargos to differentiate CLT from non-CLT positions
ALTER TABLE public.rh_cargos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'advogado';

-- Update existing cargos based on their names
UPDATE public.rh_cargos SET tipo = 'clt' WHERE nome IN ('Auxiliar Administrativo', 'Assistente Comercial');
UPDATE public.rh_cargos SET tipo = 'socio' WHERE nome = 'Sócio';
UPDATE public.rh_cargos SET tipo = 'advogado' WHERE tipo IS NULL OR tipo = 'advogado';

-- Add comment for clarity
COMMENT ON COLUMN public.rh_cargos.tipo IS 'Tipo do cargo: clt, advogado, socio';