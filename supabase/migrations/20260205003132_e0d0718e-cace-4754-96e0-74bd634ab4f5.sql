-- Adicionar campos em zapsign_documents para vincular ao contrato e rastrear sincronização ADVBox
ALTER TABLE public.zapsign_documents 
ADD COLUMN IF NOT EXISTS fin_contrato_id uuid REFERENCES public.fin_contratos(id),
ADD COLUMN IF NOT EXISTS advbox_sync_triggered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS advbox_sync_at timestamp with time zone;

-- Adicionar campos em fin_contratos para status de assinatura
ALTER TABLE public.fin_contratos
ADD COLUMN IF NOT EXISTS zapsign_document_id uuid REFERENCES public.zapsign_documents(id),
ADD COLUMN IF NOT EXISTS assinatura_status text DEFAULT 'not_sent',
ADD COLUMN IF NOT EXISTS assinado_em timestamp with time zone;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_zapsign_documents_fin_contrato_id ON public.zapsign_documents(fin_contrato_id);
CREATE INDEX IF NOT EXISTS idx_fin_contratos_assinatura_status ON public.fin_contratos(assinatura_status);
CREATE INDEX IF NOT EXISTS idx_fin_contratos_zapsign_document_id ON public.fin_contratos(zapsign_document_id);

-- Comentários para documentação
COMMENT ON COLUMN public.fin_contratos.assinatura_status IS 'Status da assinatura: not_sent, pending_signature, signed, manual_signature';
COMMENT ON COLUMN public.zapsign_documents.advbox_sync_triggered IS 'Se já foi disparada sincronização com ADVBox após assinatura';