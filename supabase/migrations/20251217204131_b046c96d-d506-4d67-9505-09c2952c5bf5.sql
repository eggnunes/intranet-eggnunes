-- Drop existing broken policies
DROP POLICY IF EXISTS "Participantes podem ver membros da conversa" ON public.conversation_participants;
DROP POLICY IF EXISTS "Usuários podem ver conversas que participam" ON public.conversations;
DROP POLICY IF EXISTS "Participantes podem enviar mensagens" ON public.messages;
DROP POLICY IF EXISTS "Participantes podem ver mensagens" ON public.messages;

-- Recreate conversation_participants SELECT policy correctly
CREATE POLICY "Participantes podem ver membros da conversa" 
ON public.conversation_participants 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT cp.conversation_id 
    FROM public.conversation_participants cp 
    WHERE cp.user_id = auth.uid()
  )
);

-- Recreate conversations SELECT policy correctly
CREATE POLICY "Usuários podem ver conversas que participam" 
ON public.conversations 
FOR SELECT 
USING (
  id IN (
    SELECT cp.conversation_id 
    FROM public.conversation_participants cp 
    WHERE cp.user_id = auth.uid()
  )
);

-- Recreate messages SELECT policy correctly
CREATE POLICY "Participantes podem ver mensagens" 
ON public.messages 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT cp.conversation_id 
    FROM public.conversation_participants cp 
    WHERE cp.user_id = auth.uid()
  )
);

-- Recreate messages INSERT policy correctly
CREATE POLICY "Participantes podem enviar mensagens" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  is_approved(auth.uid()) 
  AND sender_id = auth.uid() 
  AND conversation_id IN (
    SELECT cp.conversation_id 
    FROM public.conversation_participants cp 
    WHERE cp.user_id = auth.uid()
  )
);