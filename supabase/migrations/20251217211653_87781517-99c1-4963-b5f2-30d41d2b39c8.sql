-- Fix SELECT policy for conversations to allow creator to see their own conversation
DROP POLICY IF EXISTS "Usuários podem ver conversas que participam" ON public.conversations;

CREATE POLICY "Usuários podem ver conversas que participam"
ON public.conversations
FOR SELECT
USING (
  created_by = auth.uid()
  OR is_conversation_participant(auth.uid(), id)
);