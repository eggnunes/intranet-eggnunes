
CREATE TABLE public.crm_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_made INTEGER NOT NULL DEFAULT 0,
  meetings_held INTEGER NOT NULL DEFAULT 0,
  proposals_sent INTEGER NOT NULL DEFAULT 0,
  contracts_signed INTEGER NOT NULL DEFAULT 0,
  new_leads INTEGER NOT NULL DEFAULT 0,
  follow_ups INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE public.crm_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily logs"
  ON public.crm_daily_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Users can insert own daily logs"
  ON public.crm_daily_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily logs"
  ON public.crm_daily_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own daily logs"
  ON public.crm_daily_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_crm_daily_logs_updated_at
  BEFORE UPDATE ON public.crm_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
