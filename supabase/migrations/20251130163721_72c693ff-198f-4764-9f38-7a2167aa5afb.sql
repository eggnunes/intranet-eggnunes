-- Criar tabela para agendamento de relatórios do Advbox
CREATE TABLE IF NOT EXISTS public.advbox_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  include_lawsuits BOOLEAN DEFAULT true,
  include_publications BOOLEAN DEFAULT true,
  include_tasks BOOLEAN DEFAULT true,
  include_financial BOOLEAN DEFAULT true,
  export_format TEXT NOT NULL CHECK (export_format IN ('pdf', 'excel', 'both')),
  email_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advbox_report_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios agendamentos"
  ON public.advbox_report_schedules
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar seus próprios agendamentos"
  ON public.advbox_report_schedules
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
  ON public.advbox_report_schedules
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar seus próprios agendamentos"
  ON public.advbox_report_schedules
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins podem ver todos os agendamentos
CREATE POLICY "Admins podem ver todos os agendamentos"
  ON public.advbox_report_schedules
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_advbox_report_schedules_updated_at
  BEFORE UPDATE ON public.advbox_report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();