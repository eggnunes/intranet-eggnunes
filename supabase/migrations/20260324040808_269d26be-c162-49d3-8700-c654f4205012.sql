CREATE TABLE public.daily_digest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  email TEXT,
  position TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_digest_logs_run_id ON public.daily_digest_logs(run_id);
CREATE INDEX idx_daily_digest_logs_created_at ON public.daily_digest_logs(created_at DESC);
CREATE INDEX idx_daily_digest_logs_profile_id ON public.daily_digest_logs(profile_id);
CREATE INDEX idx_daily_digest_logs_status ON public.daily_digest_logs(status);

ALTER TABLE public.daily_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and socios can view daily digest logs"
ON public.daily_digest_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_socio(auth.uid()));