-- Adicionar campo para armazenar nome do cliente do ADVBox
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

-- Atualizar lançamentos existentes do ADVBox para extrair cliente_nome das observações
UPDATE public.fin_lancamentos 
SET cliente_nome = substring(observacoes from 'Cliente: ([^\n]+)')
WHERE origem = 'advbox' 
  AND cliente_nome IS NULL 
  AND observacoes LIKE '%Cliente:%';

COMMENT ON COLUMN public.fin_lancamentos.cliente_nome IS 'Nome do cliente (usado para importações do ADVBox quando não vinculado a fin_clientes)';