-- Criar tabela de comentários nas sugestões
CREATE TABLE public.suggestion_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de comentários
ALTER TABLE public.suggestion_comments ENABLE ROW LEVEL SECURITY;

-- Políticas para comentários: usuários aprovados podem criar e ver comentários
CREATE POLICY "Usuários aprovados podem criar comentários"
  ON public.suggestion_comments
  FOR INSERT
  WITH CHECK ((user_id = auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver comentários"
  ON public.suggestion_comments
  FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Criador pode atualizar seu comentário"
  ON public.suggestion_comments
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Criador pode deletar seu comentário"
  ON public.suggestion_comments
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem deletar qualquer comentário"
  ON public.suggestion_comments
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_suggestion_comments_updated_at
  BEFORE UPDATE ON public.suggestion_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Criar tabela de votos nas sugestões
CREATE TABLE public.suggestion_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- Habilitar RLS na tabela de votos
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Políticas para votos: usuários aprovados podem votar e ver votos
CREATE POLICY "Usuários aprovados podem votar"
  ON public.suggestion_votes
  FOR INSERT
  WITH CHECK ((user_id = auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver votos"
  ON public.suggestion_votes
  FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Usuários podem remover seu próprio voto"
  ON public.suggestion_votes
  FOR DELETE
  USING (user_id = auth.uid());

-- Criar índices para melhor performance
CREATE INDEX idx_suggestion_comments_suggestion_id ON public.suggestion_comments(suggestion_id);
CREATE INDEX idx_suggestion_comments_user_id ON public.suggestion_comments(user_id);
CREATE INDEX idx_suggestion_votes_suggestion_id ON public.suggestion_votes(suggestion_id);
CREATE INDEX idx_suggestion_votes_user_id ON public.suggestion_votes(user_id);