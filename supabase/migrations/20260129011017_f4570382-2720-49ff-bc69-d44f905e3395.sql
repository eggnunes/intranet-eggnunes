-- Temporarily disable the audit triggers
ALTER TABLE public.fin_lancamentos DISABLE TRIGGER audit_fin_lancamentos;
ALTER TABLE public.fin_lancamentos DISABLE TRIGGER fin_lancamentos_audit;

-- Delete existing advbox records to reimport fresh with correct data
DELETE FROM public.fin_lancamentos WHERE advbox_transaction_id IS NOT NULL;

-- Reset sync status to re-import all records with corrected logic
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

-- Re-enable the audit triggers
ALTER TABLE public.fin_lancamentos ENABLE TRIGGER audit_fin_lancamentos;
ALTER TABLE public.fin_lancamentos ENABLE TRIGGER fin_lancamentos_audit;