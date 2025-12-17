
-- Tabela para encaminhamento de mensagens
CREATE TABLE public.feedback_forwards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedback_box(id) ON DELETE CASCADE,
  forwarded_to UUID NOT NULL,
  forwarded_by UUID NOT NULL,
  forwarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  note TEXT
);

-- Tabela para respostas às mensagens
CREATE TABLE public.feedback_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedback_box(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- Políticas para feedback_forwards
CREATE POLICY "Rafael pode gerenciar encaminhamentos"
ON public.feedback_forwards
FOR ALL
USING (is_rafael(auth.uid()));

CREATE POLICY "Destinatários podem ver encaminhamentos"
ON public.feedback_forwards
FOR SELECT
USING (forwarded_to = auth.uid());

CREATE POLICY "Destinatários podem atualizar leitura"
ON public.feedback_forwards
FOR UPDATE
USING (forwarded_to = auth.uid());

-- Políticas para feedback_replies
CREATE POLICY "Rafael pode gerenciar respostas"
ON public.feedback_replies
FOR ALL
USING (is_rafael(auth.uid()));

CREATE POLICY "Usuários podem ver respostas de mensagens encaminhadas para eles"
ON public.feedback_replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_forwards ff
    WHERE ff.feedback_id = feedback_replies.feedback_id
    AND ff.forwarded_to = auth.uid()
  )
);

CREATE POLICY "Usuários podem responder mensagens encaminhadas"
ON public.feedback_replies
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  (
    is_rafael(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.feedback_forwards ff
      WHERE ff.feedback_id = feedback_replies.feedback_id
      AND ff.forwarded_to = auth.uid()
    )
  )
);

-- Política para permitir que destinatários vejam a mensagem original (sem revelar remetente)
CREATE POLICY "Destinatários podem ver mensagens encaminhadas"
ON public.feedback_box
FOR SELECT
USING (
  is_rafael(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.feedback_forwards ff
    WHERE ff.feedback_id = feedback_box.id
    AND ff.forwarded_to = auth.uid()
  )
);
