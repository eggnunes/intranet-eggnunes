-- Criar tabela para histórico de alterações de status das tarefas
CREATE TABLE IF NOT EXISTS public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todo o histórico
CREATE POLICY "Admins podem ver todo o histórico de alterações"
ON public.task_status_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Usuários aprovados podem ver histórico de suas tarefas
CREATE POLICY "Usuários podem ver histórico de suas próprias tarefas"
ON public.task_status_history
FOR SELECT
USING (is_approved(auth.uid()));

-- Sistema pode inserir histórico
CREATE POLICY "Sistema pode inserir histórico de alterações"
ON public.task_status_history
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND changed_by = auth.uid());

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON public.task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_changed_at ON public.task_status_history(changed_at DESC);