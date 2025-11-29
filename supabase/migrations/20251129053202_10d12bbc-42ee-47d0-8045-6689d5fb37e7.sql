-- Adicionar campos position e avatar_url à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN position TEXT,
ADD COLUMN avatar_url TEXT;

-- Criar enum para cargos
CREATE TYPE public.position_type AS ENUM ('socio', 'advogado', 'estagiario', 'comercial', 'administrativo');

-- Alterar coluna position para usar o enum
ALTER TABLE public.profiles 
ALTER COLUMN position TYPE position_type USING position::position_type;

-- Criar bucket de storage para avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);

-- Políticas para o bucket de avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Criar tabela de sugestões
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de sugestões
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Políticas para sugestões
CREATE POLICY "Usuários podem criar sugestões"
ON public.suggestions FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem ver suas próprias sugestões"
ON public.suggestions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todas as sugestões"
ON public.suggestions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar sugestões"
ON public.suggestions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de tópicos do fórum
CREATE TABLE public.forum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_post_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS na tabela de tópicos
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;

-- Políticas para tópicos do fórum
CREATE POLICY "Usuários aprovados podem criar tópicos"
ON public.forum_topics FOR INSERT
WITH CHECK (created_by = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver tópicos"
ON public.forum_topics FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Criador pode atualizar seu tópico"
ON public.forum_topics FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Admins podem atualizar qualquer tópico"
ON public.forum_topics FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Criador pode deletar seu tópico"
ON public.forum_topics FOR DELETE
USING (created_by = auth.uid());

CREATE POLICY "Admins podem deletar qualquer tópico"
ON public.forum_topics FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de posts do fórum
CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de posts
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

-- Políticas para posts do fórum
CREATE POLICY "Usuários aprovados podem criar posts"
ON public.forum_posts FOR INSERT
WITH CHECK (created_by = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver posts"
ON public.forum_posts FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Criador pode atualizar seu post"
ON public.forum_posts FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Admins podem atualizar qualquer post"
ON public.forum_posts FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Criador pode deletar seu post"
ON public.forum_posts FOR DELETE
USING (created_by = auth.uid());

CREATE POLICY "Admins podem deletar qualquer post"
ON public.forum_posts FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de documentos úteis
CREATE TABLE public.useful_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de documentos
ALTER TABLE public.useful_documents ENABLE ROW LEVEL SECURITY;

-- Políticas para documentos úteis
CREATE POLICY "Admins podem criar documentos"
ON public.useful_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários aprovados podem ver documentos"
ON public.useful_documents FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem atualizar documentos"
ON public.useful_documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar documentos"
ON public.useful_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Criar bucket de storage para documentos úteis
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

-- Políticas para o bucket de documentos
CREATE POLICY "Usuários aprovados podem ver documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND is_approved(auth.uid()));

CREATE POLICY "Admins podem fazer upload de documentos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar documentos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar documentos"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_forum_topics_updated_at
  BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_useful_documents_updated_at
  BEFORE UPDATE ON public.useful_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para atualizar last_post_at nos tópicos do fórum
CREATE OR REPLACE FUNCTION public.update_forum_topic_last_post()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.forum_topics
  SET last_post_at = NEW.created_at
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_topic_last_post
  AFTER INSERT ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_forum_topic_last_post();

-- Habilitar realtime para notificações de novos usuários
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;