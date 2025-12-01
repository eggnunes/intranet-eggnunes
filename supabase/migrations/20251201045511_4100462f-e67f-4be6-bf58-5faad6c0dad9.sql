-- Criar tabela para regras de cobrança automática
CREATE TABLE IF NOT EXISTS public.collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  days_overdue INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  send_time TIME NOT NULL DEFAULT '09:00:00',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;

-- Política para admins gerenciarem regras
CREATE POLICY "Admins podem gerenciar regras de cobrança"
ON public.collection_rules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins visualizarem regras
CREATE POLICY "Admins podem ver regras de cobrança"
ON public.collection_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Criar índice para melhor performance
CREATE INDEX idx_collection_rules_active ON public.collection_rules(is_active);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_collection_rules_updated_at
BEFORE UPDATE ON public.collection_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();