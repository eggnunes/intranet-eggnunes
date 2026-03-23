
-- Create fin_dashboard_cache table (singleton pattern)
CREATE TABLE IF NOT EXISTS public.fin_dashboard_cache (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  dashboard_data JSONB DEFAULT '{}'::jsonb,
  periodo TEXT DEFAULT 'mes_atual',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fin_dashboard_cache ENABLE ROW LEVEL SECURITY;

-- Read policy for authenticated users
CREATE POLICY "Authenticated users can read fin_dashboard_cache"
  ON public.fin_dashboard_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_dashboard_cache;

-- Insert initial singleton row
INSERT INTO public.fin_dashboard_cache (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;
