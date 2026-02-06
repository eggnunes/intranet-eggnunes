
-- Adicionar novas colunas para rastrear os 5 signatários em contratos
ALTER TABLE public.zapsign_documents 
  ADD COLUMN IF NOT EXISTS marcos_signer_token text,
  ADD COLUMN IF NOT EXISTS marcos_signer_status text,
  ADD COLUMN IF NOT EXISTS rafael_signer_token text,
  ADD COLUMN IF NOT EXISTS rafael_signer_status text,
  ADD COLUMN IF NOT EXISTS witness1_name text,
  ADD COLUMN IF NOT EXISTS witness1_signer_token text,
  ADD COLUMN IF NOT EXISTS witness1_signer_status text,
  ADD COLUMN IF NOT EXISTS witness2_name text,
  ADD COLUMN IF NOT EXISTS witness2_signer_token text,
  ADD COLUMN IF NOT EXISTS witness2_signer_status text;
