
-- Criar tabela de folgas
CREATE TABLE public.rh_folgas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_folga DATE NOT NULL,
  motivo TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_colaborador_data_folga UNIQUE (colaborador_id, data_folga)
);

-- Enable RLS
ALTER TABLE public.rh_folgas ENABLE ROW LEVEL SECURITY;

-- SELECT: próprias folgas OU admin/socio/administrativo
CREATE POLICY "Users can view own folgas"
  ON public.rh_folgas FOR SELECT
  USING (
    colaborador_id = auth.uid()
    OR is_admin_or_socio(auth.uid())
    OR (SELECT position FROM public.profiles WHERE id = auth.uid()) = 'administrativo'
  );

-- INSERT: apenas admin/socio/administrativo
CREATE POLICY "Admins can insert folgas"
  ON public.rh_folgas FOR INSERT
  WITH CHECK (
    is_admin_or_socio(auth.uid())
    OR (SELECT position FROM public.profiles WHERE id = auth.uid()) = 'administrativo'
  );

-- UPDATE: apenas admin/socio/administrativo
CREATE POLICY "Admins can update folgas"
  ON public.rh_folgas FOR UPDATE
  USING (
    is_admin_or_socio(auth.uid())
    OR (SELECT position FROM public.profiles WHERE id = auth.uid()) = 'administrativo'
  );

-- DELETE: apenas admin/socio/administrativo
CREATE POLICY "Admins can delete folgas"
  ON public.rh_folgas FOR DELETE
  USING (
    is_admin_or_socio(auth.uid())
    OR (SELECT position FROM public.profiles WHERE id = auth.uid()) = 'administrativo'
  );

-- Index for performance
CREATE INDEX idx_rh_folgas_colaborador ON public.rh_folgas(colaborador_id);
CREATE INDEX idx_rh_folgas_data ON public.rh_folgas(data_folga);
