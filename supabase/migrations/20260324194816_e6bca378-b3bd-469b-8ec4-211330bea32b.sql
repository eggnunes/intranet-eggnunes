CREATE TABLE public.tutorial_seen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, page_key)
);
ALTER TABLE public.tutorial_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tutorial state" ON public.tutorial_seen
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);