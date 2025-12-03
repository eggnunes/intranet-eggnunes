-- Adicionar coluna de categoria na tabela de jurisprudências salvas
ALTER TABLE public.saved_jurisprudence 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'geral';

-- Adicionar coluna de tribunal
ALTER TABLE public.saved_jurisprudence 
ADD COLUMN IF NOT EXISTS court text;

-- Criar índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_saved_jurisprudence_category ON public.saved_jurisprudence(category);
CREATE INDEX IF NOT EXISTS idx_saved_jurisprudence_court ON public.saved_jurisprudence(court);