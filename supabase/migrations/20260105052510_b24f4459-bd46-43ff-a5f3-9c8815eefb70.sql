-- Adicionar colunas para status do processo ADVBOX
ALTER TABLE public.fin_contratos 
ADD COLUMN IF NOT EXISTS status_processo TEXT,
ADD COLUMN IF NOT EXISTS numero_processo TEXT;