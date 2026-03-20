
-- Drop existing admin policies on rh-documentos bucket
DROP POLICY IF EXISTS "Admins can view all rh-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload rh-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete rh-documentos" ON storage.objects;

-- Recreate using has_role() instead of admin_permissions check
CREATE POLICY "Admins can view all rh-documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rh-documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.is_socio_or_rafael(auth.uid()))
);

CREATE POLICY "Admins can upload rh-documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rh-documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.is_socio_or_rafael(auth.uid()))
);

CREATE POLICY "Admins can delete rh-documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rh-documentos'
  AND (public.has_role(auth.uid(), 'admin') OR public.is_socio_or_rafael(auth.uid()))
);
