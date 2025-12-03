-- Tabela para histórico de pesquisas de jurisprudência
CREATE TABLE public.jurisprudence_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para jurisprudências salvas
CREATE TABLE public.saved_jurisprudence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  search_id UUID REFERENCES public.jurisprudence_searches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jurisprudence_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jurisprudence ENABLE ROW LEVEL SECURITY;

-- Políticas para jurisprudence_searches
CREATE POLICY "Usuários podem ver suas próprias pesquisas"
ON public.jurisprudence_searches FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar suas próprias pesquisas"
ON public.jurisprudence_searches FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas próprias pesquisas"
ON public.jurisprudence_searches FOR DELETE
USING (user_id = auth.uid());

-- Políticas para saved_jurisprudence
CREATE POLICY "Usuários podem ver suas jurisprudências salvas"
ON public.saved_jurisprudence FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem salvar jurisprudências"
ON public.saved_jurisprudence FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar suas jurisprudências"
ON public.saved_jurisprudence FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas jurisprudências"
ON public.saved_jurisprudence FOR DELETE
USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_saved_jurisprudence_updated_at
BEFORE UPDATE ON public.saved_jurisprudence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();