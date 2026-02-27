
ALTER TABLE public.favorable_decisions
  ADD COLUMN IF NOT EXISTS reu text,
  ADD COLUMN IF NOT EXISTS regiao text,
  ADD COLUMN IF NOT EXISTS materia text,
  ADD COLUMN IF NOT EXISTS resultado text,
  ADD COLUMN IF NOT EXISTS decisao_texto text,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS notify_team boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_message text;
