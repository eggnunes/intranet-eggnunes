
-- Tabela principal para armazenar publicações DJE consultadas
CREATE TABLE public.publicacoes_dje (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_processo TEXT NOT NULL,
  tribunal TEXT,
  tipo_comunicacao TEXT,
  data_disponibilizacao TIMESTAMP WITH TIME ZONE,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  conteudo TEXT,
  destinatario TEXT,
  meio TEXT,
  nome_advogado TEXT,
  numero_comunicacao TEXT,
  siglaTribunal TEXT,
  hash TEXT UNIQUE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para marcar publicações como lidas por usuário
CREATE TABLE public.publicacoes_dje_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publicacao_id UUID NOT NULL REFERENCES public.publicacoes_dje(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(publicacao_id, user_id)
);

-- Índices
CREATE INDEX idx_publicacoes_dje_processo ON public.publicacoes_dje(numero_processo);
CREATE INDEX idx_publicacoes_dje_data ON public.publicacoes_dje(data_disponibilizacao);
CREATE INDEX idx_publicacoes_dje_tribunal ON public.publicacoes_dje(siglaTribunal);
CREATE INDEX idx_publicacoes_dje_hash ON public.publicacoes_dje(hash);

-- Enable RLS
ALTER TABLE public.publicacoes_dje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes_dje_reads ENABLE ROW LEVEL SECURITY;

-- Policies: approved users can read
CREATE POLICY "Approved users can view publicacoes" ON public.publicacoes_dje
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

-- Approved users can insert (via edge function or cache)
CREATE POLICY "Approved users can insert publicacoes" ON public.publicacoes_dje
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved(auth.uid()));

-- Reads policies
CREATE POLICY "Users can view their own reads" ON public.publicacoes_dje_reads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark as read" ON public.publicacoes_dje_reads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "Users can unmark read" ON public.publicacoes_dje_reads
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_publicacoes_dje_updated_at
  BEFORE UPDATE ON public.publicacoes_dje
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
