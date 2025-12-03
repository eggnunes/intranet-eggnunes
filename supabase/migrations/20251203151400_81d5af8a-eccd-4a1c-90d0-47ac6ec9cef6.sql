-- Adicionar campo de data de ingresso no escritório
ALTER TABLE public.profiles 
ADD COLUMN join_date date NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.join_date IS 'Data de ingresso do colaborador no escritório. Editável pelo usuário apenas no cadastro, depois só por administradores.';