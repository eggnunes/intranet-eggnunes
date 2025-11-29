-- Remover políticas que permitem autores deletarem/editarem seus próprios comentários
DROP POLICY IF EXISTS "Criador pode atualizar seu comentário" ON public.suggestion_comments;
DROP POLICY IF EXISTS "Criador pode deletar seu comentário" ON public.suggestion_comments;

-- Criar tabela de tags
CREATE TABLE public.suggestion_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de tags
ALTER TABLE public.suggestion_tags ENABLE ROW LEVEL SECURITY;

-- Políticas para tags: usuários aprovados podem ver, apenas admins podem criar/editar/deletar
CREATE POLICY "Usuários aprovados podem ver tags"
  ON public.suggestion_tags
  FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem criar tags"
  ON public.suggestion_tags
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar tags"
  ON public.suggestion_tags
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar tags"
  ON public.suggestion_tags
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela de relacionamento entre sugestões e tags
CREATE TABLE public.suggestion_tag_relations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.suggestion_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, tag_id)
);

-- Habilitar RLS
ALTER TABLE public.suggestion_tag_relations ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários aprovados podem ver, apenas admins podem criar/deletar
CREATE POLICY "Usuários aprovados podem ver relações de tags"
  ON public.suggestion_tag_relations
  FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem criar relações de tags"
  ON public.suggestion_tag_relations
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar relações de tags"
  ON public.suggestion_tag_relations
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar índices
CREATE INDEX idx_suggestion_tag_relations_suggestion_id ON public.suggestion_tag_relations(suggestion_id);
CREATE INDEX idx_suggestion_tag_relations_tag_id ON public.suggestion_tag_relations(tag_id);

-- Inserir algumas tags padrão
INSERT INTO public.suggestion_tags (name, color) VALUES
  ('Urgente', '#ef4444'),
  ('Em desenvolvimento', '#f59e0b'),
  ('Planejado', '#3b82f6'),
  ('Duplicada', '#6b7280'),
  ('Boa ideia', '#10b981');