
-- Table for procuração drafts
CREATE TABLE public.procuracao_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id INTEGER NOT NULL,
  client_name TEXT,
  qualification TEXT,
  tem_poderes_especiais BOOLEAN DEFAULT false,
  poderes_especiais TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- RLS
ALTER TABLE public.procuracao_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own procuracao drafts"
  ON public.procuracao_drafts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_procuracao_drafts_updated_at
  BEFORE UPDATE ON public.procuracao_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
