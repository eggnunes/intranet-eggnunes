
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update existing records: completed = true -> status = 'completed'
UPDATE public.crm_activities SET status = 'completed' WHERE completed = true AND (status IS NULL OR status = 'pending');
