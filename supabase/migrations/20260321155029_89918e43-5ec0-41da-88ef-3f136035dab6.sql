
CREATE TABLE IF NOT EXISTS public.meta_ads_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analysis_text TEXT NOT NULL,
  date_from TEXT,
  date_to TEXT,
  campaigns_count INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ads_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own analyses"
  ON public.meta_ads_ai_analyses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert analyses"
  ON public.meta_ads_ai_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);
