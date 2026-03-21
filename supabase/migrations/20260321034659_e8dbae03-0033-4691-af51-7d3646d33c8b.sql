
-- Tabelas para Agentes da Intranet
CREATE TABLE public.intranet_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  instructions TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  icon_emoji TEXT NOT NULL DEFAULT '🤖',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.intranet_agent_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.intranet_agent_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.intranet_agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.intranet_agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_intranet_agents_created_by ON public.intranet_agents(created_by);
CREATE INDEX idx_intranet_agent_files_agent ON public.intranet_agent_files(agent_id);
CREATE INDEX idx_intranet_agent_conversations_agent ON public.intranet_agent_conversations(agent_id);
CREATE INDEX idx_intranet_agent_conversations_user ON public.intranet_agent_conversations(user_id);
CREATE INDEX idx_intranet_agent_messages_conversation ON public.intranet_agent_messages(conversation_id);

-- Triggers
CREATE TRIGGER update_intranet_agents_updated_at
  BEFORE UPDATE ON public.intranet_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intranet_agent_conversations_updated_at
  BEFORE UPDATE ON public.intranet_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.intranet_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_messages ENABLE ROW LEVEL SECURITY;

-- Agents: approved users can view active agents
CREATE POLICY "Approved users can view active agents"
  ON public.intranet_agents FOR SELECT
  TO authenticated
  USING (is_approved(auth.uid()) AND is_active = true);

-- Agents: creator or admin can manage
CREATE POLICY "Creator can insert agents"
  ON public.intranet_agents FOR INSERT
  TO authenticated
  WITH CHECK (is_approved(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Creator or admin can update agents"
  ON public.intranet_agents FOR UPDATE
  TO authenticated
  USING (is_approved(auth.uid()) AND (auth.uid() = created_by OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Creator or admin can delete agents"
  ON public.intranet_agents FOR DELETE
  TO authenticated
  USING (is_approved(auth.uid()) AND (auth.uid() = created_by OR has_role(auth.uid(), 'admin')));

-- Agent files: same as agents via agent_id
CREATE POLICY "Approved users can view agent files"
  ON public.intranet_agent_files FOR SELECT
  TO authenticated
  USING (is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.intranet_agents WHERE id = agent_id AND is_active = true
  ));

CREATE POLICY "Creator can manage agent files"
  ON public.intranet_agent_files FOR INSERT
  TO authenticated
  WITH CHECK (is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.intranet_agents WHERE id = agent_id AND created_by = auth.uid()
  ));

CREATE POLICY "Creator can delete agent files"
  ON public.intranet_agent_files FOR DELETE
  TO authenticated
  USING (is_approved(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.intranet_agents WHERE id = agent_id AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
  ));

-- Conversations: user can only see their own
CREATE POLICY "Users can view own conversations"
  ON public.intranet_agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON public.intranet_agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_approved(auth.uid()));

CREATE POLICY "Users can update own conversations"
  ON public.intranet_agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.intranet_agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Messages: user can only access via their conversations
CREATE POLICY "Users can view own messages"
  ON public.intranet_agent_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.intranet_agent_conversations WHERE id = conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages"
  ON public.intranet_agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.intranet_agent_conversations WHERE id = conversation_id AND user_id = auth.uid()
  ));

-- Storage bucket for agent files
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-files', 'agent-files', false);

CREATE POLICY "Approved users can upload agent files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agent-files' AND is_approved(auth.uid()));

CREATE POLICY "Approved users can view agent files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'agent-files' AND is_approved(auth.uid()));

CREATE POLICY "Users can delete own agent files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agent-files' AND is_approved(auth.uid()));
