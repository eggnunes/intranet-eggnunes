-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios avatars" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios avatars" ON storage.objects;

-- Política para permitir upload de avatars
CREATE POLICY "Usuários podem fazer upload de seus avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Política para permitir visualização pública de avatars
CREATE POLICY "Avatars são publicamente visíveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Política para permitir atualização de avatars próprios
CREATE POLICY "Usuários podem atualizar seus avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '-'))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '-'))[1]
);

-- Política para permitir deleção de avatars próprios
CREATE POLICY "Usuários podem deletar seus avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '-'))[1]
);