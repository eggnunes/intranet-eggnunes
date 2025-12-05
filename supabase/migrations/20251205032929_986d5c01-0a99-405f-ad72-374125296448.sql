-- Make the documents bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';

-- Add RLS policies for the documents bucket (if not already exists)
-- Allow authenticated users to select their uploaded documents
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
CREATE POLICY "Approved users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  is_approved(auth.uid())
);

-- Allow admins with document permission to upload
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  is_approved(auth.uid()) AND
  has_role(auth.uid(), 'admin')
);

-- Allow admins with document permission to delete
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  is_approved(auth.uid()) AND
  has_role(auth.uid(), 'admin')
);