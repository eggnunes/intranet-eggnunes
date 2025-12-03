-- Tabela para rastrear publicações/movimentações lidas
CREATE TABLE public.publication_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lawsuit_id BIGINT NOT NULL,
  movement_date DATE NOT NULL,
  movement_title TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, lawsuit_id, movement_date, movement_title)
);

-- Enable RLS
ALTER TABLE public.publication_reads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own reads"
ON public.publication_reads
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can mark as read"
ON public.publication_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark reads"
ON public.publication_reads
FOR DELETE
USING (auth.uid() = user_id);

-- Index para busca rápida
CREATE INDEX idx_publication_reads_user_lawsuit ON public.publication_reads(user_id, lawsuit_id);
CREATE INDEX idx_publication_reads_user ON public.publication_reads(user_id);