-- Add 'advbox' as a valid origem value in fin_lancamentos
ALTER TABLE public.fin_lancamentos DROP CONSTRAINT IF EXISTS fin_lancamentos_origem_check;

ALTER TABLE public.fin_lancamentos ADD CONSTRAINT fin_lancamentos_origem_check 
CHECK (origem IN ('escritorio', 'cliente', 'advbox'));

-- Reset sync status to start fresh
UPDATE public.advbox_sync_status 
SET 
  status = 'idle',
  last_offset = 0,
  total_processed = 0,
  total_created = 0,
  total_updated = 0,
  total_skipped = 0,
  error_message = NULL,
  completed_at = NULL,
  updated_at = NOW()
WHERE sync_type = 'financial';