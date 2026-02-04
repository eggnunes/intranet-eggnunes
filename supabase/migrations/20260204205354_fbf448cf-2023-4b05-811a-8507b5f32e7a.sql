-- Criar tabela para controle de férias informais/adiantadas
CREATE TABLE public.informal_vacation_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('adiantamento', 'informal', 'compensacao', 'outro')),
  dias INTEGER NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  descricao TEXT,
  observacoes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.informal_vacation_records ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se é admin ou sócio
CREATE OR REPLACE FUNCTION public.is_admin_or_socio(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_id
    AND p.approval_status = 'approved'
    AND p.position = 'socio'
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = user_id
    AND ur.role = 'admin'
  )
$$;

-- Apenas administradores e sócios podem ver registros
CREATE POLICY "Admins and socios can view informal vacation records"
  ON public.informal_vacation_records
  FOR SELECT
  USING (public.is_admin_or_socio(auth.uid()));

-- Apenas administradores e sócios podem inserir
CREATE POLICY "Admins and socios can insert informal vacation records"
  ON public.informal_vacation_records
  FOR INSERT
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

-- Apenas administradores e sócios podem atualizar
CREATE POLICY "Admins and socios can update informal vacation records"
  ON public.informal_vacation_records
  FOR UPDATE
  USING (public.is_admin_or_socio(auth.uid()));

-- Apenas administradores e sócios podem deletar
CREATE POLICY "Admins and socios can delete informal vacation records"
  ON public.informal_vacation_records
  FOR DELETE
  USING (public.is_admin_or_socio(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_informal_vacation_records_updated_at
  BEFORE UPDATE ON public.informal_vacation_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();