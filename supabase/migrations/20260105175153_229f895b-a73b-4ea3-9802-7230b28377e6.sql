-- Remove duplicate columns that were created (using endereco_* naming instead)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS rua;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS numero;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS complemento;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS bairro;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cidade;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS estado;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cep;