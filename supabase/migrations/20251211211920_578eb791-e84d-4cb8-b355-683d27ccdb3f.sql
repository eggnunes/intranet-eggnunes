-- Tabela para armazenar chaves TOTP de autenticação
CREATE TABLE public.totp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  secret_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.totp_accounts ENABLE ROW LEVEL SECURITY;

-- Todos os usuários aprovados podem visualizar
CREATE POLICY "Approved users can view TOTP accounts"
  ON public.totp_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- Apenas admins podem gerenciar
CREATE POLICY "Admins can insert TOTP accounts"
  ON public.totp_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update TOTP accounts"
  ON public.totp_accounts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete TOTP accounts"
  ON public.totp_accounts
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_totp_accounts_updated_at
  BEFORE UPDATE ON public.totp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();