-- Add OAB fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN oab_number TEXT,
ADD COLUMN oab_state TEXT;

COMMENT ON COLUMN public.profiles.oab_number IS 'Número da OAB para advogados e estagiários';
COMMENT ON COLUMN public.profiles.oab_state IS 'Estado da OAB (ex: SP, RJ, MG)';