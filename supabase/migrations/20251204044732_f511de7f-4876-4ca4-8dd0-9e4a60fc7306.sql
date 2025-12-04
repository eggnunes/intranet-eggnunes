-- Ensure proper storage policies for resumes bucket
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can download resumes'
  ) THEN
    CREATE POLICY "Admins can download resumes"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'resumes' 
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload resumes'
  ) THEN
    CREATE POLICY "Admins can upload resumes"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'resumes' 
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete resumes'
  ) THEN
    CREATE POLICY "Admins can delete resumes"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'resumes' 
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;
END $$;