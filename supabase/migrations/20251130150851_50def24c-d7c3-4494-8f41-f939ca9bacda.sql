-- Atualizar políticas de avatars para usar pasta com id do usuário
DROP POLICY IF EXISTS "Usuários podem fazer upload de seus avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars são publicamente visíveis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus avatars" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus avatars" ON storage.objects;

-- Upload de avatar: caminho "<user_id>/<arquivo>"
CREATE POLICY "Usuários podem fazer upload de seus avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Visualização pública dos avatars
CREATE POLICY "Avatars são publicamente visíveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Atualização de avatar próprio
CREATE POLICY "Usuários podem atualizar seus avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Exclusão de avatar próprio
CREATE POLICY "Usuários podem deletar seus avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);