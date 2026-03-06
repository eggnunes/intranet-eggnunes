
-- Tabela de fornecedores/telefones úteis
CREATE TABLE public.fornecedores_uteis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  categoria TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de senhas úteis
CREATE TABLE public.senhas_uteis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  usuario TEXT,
  senha TEXT,
  url TEXT,
  categoria TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fornecedores_uteis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senhas_uteis ENABLE ROW LEVEL SECURITY;

-- Fornecedores: todos aprovados podem ver
CREATE POLICY "Approved users can view fornecedores"
  ON public.fornecedores_uteis FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- Fornecedores: apenas admins/sócios podem inserir
CREATE POLICY "Admins can insert fornecedores"
  ON public.fornecedores_uteis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

-- Fornecedores: apenas admins/sócios podem editar
CREATE POLICY "Admins can update fornecedores"
  ON public.fornecedores_uteis FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

-- Fornecedores: apenas admins/sócios podem deletar
CREATE POLICY "Admins can delete fornecedores"
  ON public.fornecedores_uteis FOR DELETE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

-- Senhas: apenas admins/sócios para todas as operações
CREATE POLICY "Admins can view senhas"
  ON public.senhas_uteis FOR SELECT
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can insert senhas"
  ON public.senhas_uteis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can update senhas"
  ON public.senhas_uteis FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete senhas"
  ON public.senhas_uteis FOR DELETE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_fornecedores_uteis_updated_at
  BEFORE UPDATE ON public.fornecedores_uteis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_senhas_uteis_updated_at
  BEFORE UPDATE ON public.senhas_uteis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
