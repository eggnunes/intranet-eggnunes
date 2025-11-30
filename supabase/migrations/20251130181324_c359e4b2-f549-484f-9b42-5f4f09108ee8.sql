-- Criar tabela para rastrear leitura de avisos
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem marcar seus próprios avisos como lidos"
  ON public.announcement_reads
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem ver suas próprias marcações de leitura"
  ON public.announcement_reads
  FOR SELECT
  USING (user_id = auth.uid());

-- Índices para performance
CREATE INDEX idx_announcement_reads_user_id ON public.announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_announcement_id ON public.announcement_reads(announcement_id);