-- Criar tabela para armazenar sincronizações do ADVBox
CREATE TABLE IF NOT EXISTS public.advbox_financial_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advbox_transaction_id VARCHAR NOT NULL UNIQUE,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  advbox_data JSONB NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_advbox_sync_transaction_id ON public.advbox_financial_sync(advbox_transaction_id);
CREATE INDEX IF NOT EXISTS idx_advbox_sync_lancamento_id ON public.advbox_financial_sync(lancamento_id);

-- Habilitar RLS
ALTER TABLE public.advbox_financial_sync ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins e usuários com permissão financeira
CREATE POLICY "Admins podem ver sincronizações" 
ON public.advbox_financial_sync FOR SELECT 
TO public
USING (
  has_role(auth.uid(), 'admin') OR 
  is_socio_or_rafael(auth.uid()) OR
  get_admin_permission(auth.uid(), 'financial') IN ('view', 'edit')
);

CREATE POLICY "Admins podem gerenciar sincronizações" 
ON public.advbox_financial_sync FOR ALL 
TO public
USING (
  has_role(auth.uid(), 'admin') OR 
  is_socio_or_rafael(auth.uid()) OR
  get_admin_permission(auth.uid(), 'financial') = 'edit'
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  is_socio_or_rafael(auth.uid()) OR
  get_admin_permission(auth.uid(), 'financial') = 'edit'
);

-- Adicionar campo advbox_transaction_id na tabela de lançamentos para rastreabilidade
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS advbox_transaction_id VARCHAR UNIQUE;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_advbox_id ON public.fin_lancamentos(advbox_transaction_id) WHERE advbox_transaction_id IS NOT NULL;