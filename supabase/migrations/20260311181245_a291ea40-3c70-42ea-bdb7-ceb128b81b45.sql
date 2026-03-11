
CREATE TABLE public.prazos_manuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_advbox_id INTEGER,
  process_number TEXT,
  task_type TEXT NOT NULL,
  titulo TEXT NOT NULL,
  prazo_interno DATE,
  prazo_fatal DATE,
  advogado_responsavel TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prazos_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage prazos_manuais" ON public.prazos_manuais
  FOR ALL TO authenticated 
  USING (public.is_approved(auth.uid())) 
  WITH CHECK (public.is_approved(auth.uid()));
