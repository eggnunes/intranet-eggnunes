
-- Tabela singleton para cache persistente do dashboard de processos
CREATE TABLE public.advbox_dashboard_cache (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  total_lawsuits INTEGER DEFAULT 0,
  total_movements INTEGER DEFAULT 0,
  lawsuits_data JSONB DEFAULT '[]'::jsonb,
  movements_data JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: leitura para authenticated
ALTER TABLE public.advbox_dashboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dashboard cache"
  ON public.advbox_dashboard_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.advbox_dashboard_cache;

-- Inserir registro singleton
INSERT INTO public.advbox_dashboard_cache (id) VALUES ('singleton');
