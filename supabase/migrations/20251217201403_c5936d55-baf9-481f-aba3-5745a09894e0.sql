-- Sistema de Mensagens Internas

-- Tabela de conversas (1-1 e grupos)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- NULL para conversas 1-1, preenchido para grupos
  is_group BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Participantes das conversas
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Mensagens
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Caixinha de Desabafo (mensagens para sócios/Rafael)
CREATE TABLE public.feedback_box (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL, -- Sempre armazenado, mesmo se anônimo
  is_anonymous BOOLEAN DEFAULT false,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_feedback_box_created_at ON public.feedback_box(created_at DESC);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_box ENABLE ROW LEVEL SECURITY;

-- Função para verificar se é Rafael
CREATE OR REPLACE FUNCTION public.is_rafael(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND email = 'rafael@eggnunes.com.br'
  )
$$;

-- Políticas para conversations
CREATE POLICY "Usuários podem ver conversas que participam"
ON public.conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Usuários aprovados podem criar conversas"
ON public.conversations FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Criador pode atualizar conversa"
ON public.conversations FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Criador pode deletar conversa"
ON public.conversations FOR DELETE
USING (created_by = auth.uid());

-- Políticas para conversation_participants
CREATE POLICY "Participantes podem ver membros da conversa"
ON public.conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Usuários aprovados podem adicionar participantes"
ON public.conversation_participants FOR INSERT
WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Participantes podem atualizar seu last_read_at"
ON public.conversation_participants FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Criador pode remover participantes"
ON public.conversation_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
  OR user_id = auth.uid() -- Pode sair da conversa
);

-- Políticas para messages
CREATE POLICY "Participantes podem ver mensagens"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Participantes podem enviar mensagens"
ON public.messages FOR INSERT
WITH CHECK (
  is_approved(auth.uid()) 
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Autor pode editar sua mensagem"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Autor pode deletar sua mensagem"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

-- Políticas para feedback_box (Caixinha de Desabafo)
-- APENAS Rafael pode ver TODAS as mensagens (incluindo quem enviou anônimas)
CREATE POLICY "Rafael pode ver todas as mensagens"
ON public.feedback_box FOR SELECT
USING (is_rafael(auth.uid()));

CREATE POLICY "Rafael pode atualizar mensagens"
ON public.feedback_box FOR UPDATE
USING (is_rafael(auth.uid()));

CREATE POLICY "Rafael pode deletar mensagens"
ON public.feedback_box FOR DELETE
USING (is_rafael(auth.uid()));

CREATE POLICY "Usuários aprovados podem enviar mensagens"
ON public.feedback_box FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND sender_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;