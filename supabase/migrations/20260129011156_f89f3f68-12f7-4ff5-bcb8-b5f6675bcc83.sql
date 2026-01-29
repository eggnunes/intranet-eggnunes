-- Temporarily disable the audit triggers
ALTER TABLE public.fin_lancamentos DISABLE TRIGGER audit_fin_lancamentos;
ALTER TABLE public.fin_lancamentos DISABLE TRIGGER fin_lancamentos_audit;

-- Delete existing advbox records to reimport fresh with correct data
DELETE FROM public.fin_lancamentos WHERE advbox_transaction_id IS NOT NULL;

-- Re-enable the audit triggers
ALTER TABLE public.fin_lancamentos ENABLE TRIGGER audit_fin_lancamentos;
ALTER TABLE public.fin_lancamentos ENABLE TRIGGER fin_lancamentos_audit;