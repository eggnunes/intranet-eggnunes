
-- Criar tabela para documentos médicos (sigilosos)
CREATE TABLE public.rh_documentos_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_bytes INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para performance
CREATE INDEX idx_rh_documentos_medicos_colaborador ON rh_documentos_medicos(colaborador_id);

-- Habilitar RLS
ALTER TABLE rh_documentos_medicos ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é sócio
CREATE OR REPLACE FUNCTION public.is_socio(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND position = 'socio'
  );
$$;

-- Policy: Admins podem inserir documentos médicos
CREATE POLICY "Admins podem inserir documentos médicos"
ON rh_documentos_medicos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Policy: Sócios podem ver todos os documentos médicos OU usuário vê os próprios
CREATE POLICY "Sócios ou próprio usuário podem ver documentos médicos"
ON rh_documentos_medicos
FOR SELECT
TO authenticated
USING (
  public.is_socio(auth.uid()) 
  OR colaborador_id = auth.uid()
);

-- Policy: Apenas sócios podem excluir documentos médicos
CREATE POLICY "Apenas sócios podem excluir documentos médicos"
ON rh_documentos_medicos
FOR DELETE
TO authenticated
USING (
  public.is_socio(auth.uid())
);

-- Policy: Sócios podem atualizar documentos médicos
CREATE POLICY "Sócios podem atualizar documentos médicos"
ON rh_documentos_medicos
FOR UPDATE
TO authenticated
USING (
  public.is_socio(auth.uid())
);

-- Criar bucket para documentos médicos (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-documentos-medicos', 'rh-documentos-medicos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage: Admins podem fazer upload
CREATE POLICY "Admins podem fazer upload de documentos médicos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rh-documentos-medicos'
  AND public.has_role(auth.uid(), 'admin')
);

-- Policies de storage: Sócios ou próprio usuário podem ver
CREATE POLICY "Sócios ou próprio usuário podem ver arquivos médicos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rh-documentos-medicos'
  AND (
    public.is_socio(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Policies de storage: Apenas sócios podem deletar
CREATE POLICY "Apenas sócios podem deletar arquivos médicos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rh-documentos-medicos'
  AND public.is_socio(auth.uid())
);
