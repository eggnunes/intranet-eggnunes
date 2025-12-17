-- Create security definer function to check if user is participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
    AND conversation_id = _conversation_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Participantes podem ver membros da conversa" ON public.conversation_participants;
DROP POLICY IF EXISTS "Criador pode remover participantes" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participantes podem atualizar seu last_read_at" ON public.conversation_participants;
DROP POLICY IF EXISTS "Usuários aprovados podem adicionar participantes" ON public.conversation_participants;

-- Recreate policies using the security definer function
CREATE POLICY "Participantes podem ver membros da conversa"
ON public.conversation_participants
FOR SELECT
USING (
  is_conversation_participant(auth.uid(), conversation_id)
  OR user_id = auth.uid()
);

CREATE POLICY "Usuários aprovados podem adicionar participantes"
ON public.conversation_participants
FOR INSERT
WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Participantes podem atualizar seu last_read_at"
ON public.conversation_participants
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Criador pode remover participantes"
ON public.conversation_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND c.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);