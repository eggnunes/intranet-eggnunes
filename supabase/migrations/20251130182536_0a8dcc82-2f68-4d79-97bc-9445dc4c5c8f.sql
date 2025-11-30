-- Criar bucket para anexos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Criar tabela de comentários em tarefas
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de anexos em tarefas
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para comentários
CREATE POLICY "Usuários aprovados podem ver comentários"
ON public.task_comments
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem criar comentários"
ON public.task_comments
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seus próprios comentários"
ON public.task_comments
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins podem deletar qualquer comentário"
ON public.task_comments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem deletar seus próprios comentários"
ON public.task_comments
FOR DELETE
USING (user_id = auth.uid());

-- Políticas RLS para anexos
CREATE POLICY "Usuários aprovados podem ver anexos"
ON public.task_attachments
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem criar anexos"
ON public.task_attachments
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins podem deletar qualquer anexo"
ON public.task_attachments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem deletar seus próprios anexos"
ON public.task_attachments
FOR DELETE
USING (user_id = auth.uid());

-- Políticas de storage para anexos de tarefas
CREATE POLICY "Usuários aprovados podem ver anexos de tarefas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-attachments' AND is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem fazer upload de anexos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem deletar seus próprios anexos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins podem deletar qualquer anexo"
ON storage.objects
FOR DELETE
USING (bucket_id = 'task-attachments' AND has_role(auth.uid(), 'admin'::app_role));

-- Triggers para atualizar updated_at
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_created_at ON public.task_comments(created_at);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX idx_task_attachments_created_at ON public.task_attachments(created_at);