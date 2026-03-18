
CREATE TABLE public.viabilidade_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.viabilidade_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view viabilidade_clientes"
  ON public.viabilidade_clientes FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can insert viabilidade_clientes"
  ON public.viabilidade_clientes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_approved(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Approved users can update viabilidade_clientes"
  ON public.viabilidade_clientes FOR UPDATE
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Admins can delete viabilidade_clientes"
  ON public.viabilidade_clientes FOR DELETE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE TRIGGER update_viabilidade_clientes_updated_at
  BEFORE UPDATE ON public.viabilidade_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
