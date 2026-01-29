-- Permitir que conta_origem_id seja NULL para lançamentos importados do ADVBox
-- que não têm informação de conta bancária

ALTER TABLE public.fin_lancamentos 
ALTER COLUMN conta_origem_id DROP NOT NULL;