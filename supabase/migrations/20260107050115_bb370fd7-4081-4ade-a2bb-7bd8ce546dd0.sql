-- Criar bucket para documentos de RH
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-documentos', 'rh-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket rh-documentos
-- Admins e sócios podem ver todos os documentos
CREATE POLICY "Admins e sócios podem ver documentos RH" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'rh-documentos' AND
  (
    EXISTS (
      SELECT 1 FROM public.admin_permissions 
      WHERE admin_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND position = 'socio'
    )
  )
);

-- Admins e sócios podem fazer upload de documentos
CREATE POLICY "Admins e sócios podem upload documentos RH" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'rh-documentos' AND
  (
    EXISTS (
      SELECT 1 FROM public.admin_permissions 
      WHERE admin_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND position = 'socio'
    )
  )
);

-- Admins e sócios podem deletar documentos
CREATE POLICY "Admins e sócios podem deletar documentos RH" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'rh-documentos' AND
  (
    EXISTS (
      SELECT 1 FROM public.admin_permissions 
      WHERE admin_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND position = 'socio'
    )
  )
);

-- Usuários podem ver seus próprios documentos
CREATE POLICY "Usuarios podem ver seus documentos RH" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'rh-documentos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);