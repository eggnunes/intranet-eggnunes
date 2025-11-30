-- Criar tabela para armazenar prioridades de tarefas do Advbox
CREATE TABLE public.task_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  priority TEXT NOT NULL CHECK (priority IN ('alta', 'media', 'baixa')),
  set_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_priorities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários aprovados podem ver prioridades de tarefas"
ON public.task_priorities
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem definir prioridades de tarefas"
ON public.task_priorities
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND set_by = auth.uid());

CREATE POLICY "Usuários podem atualizar prioridades que definiram"
ON public.task_priorities
FOR UPDATE
USING (set_by = auth.uid())
WITH CHECK (set_by = auth.uid());

CREATE POLICY "Admins podem gerenciar todas as prioridades"
ON public.task_priorities
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_task_priorities_updated_at
BEFORE UPDATE ON public.task_priorities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_task_priorities_task_id ON public.task_priorities(task_id);
CREATE INDEX idx_task_priorities_priority ON public.task_priorities(priority);