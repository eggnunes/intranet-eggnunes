
CREATE TABLE public.prazo_verificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advbox_task_id TEXT NOT NULL,
  verificado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verificado_em TIMESTAMPTZ DEFAULT now(),
  observacoes TEXT,
  status TEXT DEFAULT 'verificado',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prazo_verificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e sócios podem ver verificações"
  ON public.prazo_verificacoes FOR SELECT
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins e sócios podem inserir verificações"
  ON public.prazo_verificacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins e sócios podem atualizar verificações"
  ON public.prazo_verificacoes FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins e sócios podem deletar verificações"
  ON public.prazo_verificacoes FOR DELETE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE INDEX idx_prazo_verificacoes_task ON public.prazo_verificacoes(advbox_task_id);
