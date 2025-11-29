-- Adicionar campo de data de nascimento na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN birth_date date;

-- Criar índice para melhorar performance em consultas de aniversários
CREATE INDEX idx_profiles_birth_date ON public.profiles(birth_date);