-- Make documents bucket public for useful documents
UPDATE storage.buckets 
SET public = true 
WHERE id = 'documents';