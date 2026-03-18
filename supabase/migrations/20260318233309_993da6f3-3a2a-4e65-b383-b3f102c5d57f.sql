
CREATE TABLE public.mood_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  observacoes TEXT,
  survey_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, survey_date)
);

ALTER TABLE public.mood_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own mood" ON public.mood_surveys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Users can read own mood" ON public.mood_surveys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "Admins can read all moods" ON public.mood_surveys
  FOR SELECT TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));
