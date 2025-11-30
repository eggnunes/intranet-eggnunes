-- Criar tabela para clientes que não devem receber mensagens de aniversário
CREATE TABLE IF NOT EXISTS public.customer_birthday_exclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  reason TEXT,
  excluded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.customer_birthday_exclusions ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar exclusões
CREATE POLICY "Admins podem gerenciar exclusões de aniversário"
  ON public.customer_birthday_exclusions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários aprovados podem visualizar exclusões
CREATE POLICY "Usuários aprovados podem ver exclusões de aniversário"
  ON public.customer_birthday_exclusions
  FOR SELECT
  USING (is_approved(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_customer_birthday_exclusions_updated_at
  BEFORE UPDATE ON public.customer_birthday_exclusions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.customer_birthday_exclusions IS 'Clientes que não devem receber mensagens de aniversário';
COMMENT ON COLUMN public.customer_birthday_exclusions.customer_id IS 'ID do cliente no Advbox';
COMMENT ON COLUMN public.customer_birthday_exclusions.reason IS 'Motivo da exclusão (opcional)';