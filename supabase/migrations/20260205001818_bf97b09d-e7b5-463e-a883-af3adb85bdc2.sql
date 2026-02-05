-- Tabela para rastrear documentos enviados ao ZapSign
CREATE TABLE public.zapsign_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_token TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contrato', 'procuracao', 'declaracao')),
  document_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_cpf TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'completed', 'expired', 'canceled')),
  sign_url TEXT,
  signed_file_url TEXT,
  original_file_url TEXT,
  office_signer_token TEXT,
  office_signer_status TEXT DEFAULT 'pending',
  client_signer_token TEXT,
  client_signer_status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.zapsign_documents ENABLE ROW LEVEL SECURITY;

-- Política para usuários aprovados visualizarem todos os documentos
CREATE POLICY "Approved users can view zapsign documents"
ON public.zapsign_documents
FOR SELECT
USING (public.is_approved(auth.uid()));

-- Política para usuários aprovados criarem documentos
CREATE POLICY "Approved users can create zapsign documents"
ON public.zapsign_documents
FOR INSERT
WITH CHECK (public.is_approved(auth.uid()));

-- Política para atualização via webhook (sem auth)
CREATE POLICY "Service role can update zapsign documents"
ON public.zapsign_documents
FOR UPDATE
USING (true);

-- Índices para melhor performance
CREATE INDEX idx_zapsign_documents_token ON public.zapsign_documents(document_token);
CREATE INDEX idx_zapsign_documents_status ON public.zapsign_documents(status);
CREATE INDEX idx_zapsign_documents_created_by ON public.zapsign_documents(created_by);

-- Trigger para updated_at
CREATE TRIGGER update_zapsign_documents_updated_at
BEFORE UPDATE ON public.zapsign_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário na tabela
COMMENT ON TABLE public.zapsign_documents IS 'Rastreamento de documentos enviados para assinatura digital via ZapSign';