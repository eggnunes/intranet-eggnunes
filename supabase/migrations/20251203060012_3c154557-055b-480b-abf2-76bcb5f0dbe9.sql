-- Create table for automatic task rules
CREATE TABLE public.task_auto_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'movement_type', 'publication_type')),
  trigger_value TEXT NOT NULL,
  task_type_id INTEGER NOT NULL,
  task_title_template TEXT NOT NULL,
  task_description_template TEXT,
  days_to_deadline INTEGER DEFAULT 7,
  responsible_user_id TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_auto_rules ENABLE ROW LEVEL SECURITY;

-- Admins can manage all rules
CREATE POLICY "Admins podem gerenciar regras de tarefas automáticas"
ON public.task_auto_rules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view rules
CREATE POLICY "Usuários aprovados podem ver regras de tarefas"
ON public.task_auto_rules
FOR SELECT
USING (is_approved(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_task_auto_rules_updated_at
BEFORE UPDATE ON public.task_auto_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();