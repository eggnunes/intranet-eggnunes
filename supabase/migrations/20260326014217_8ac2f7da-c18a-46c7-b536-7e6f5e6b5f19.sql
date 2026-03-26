
CREATE TABLE public.announcement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  is_link BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view attachments"
  ON announcement_attachments FOR SELECT TO authenticated
  USING (is_approved(auth.uid()));

CREATE POLICY "Admins can insert attachments"
  ON announcement_attachments FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete attachments"
  ON announcement_attachments FOR DELETE TO authenticated
  USING (is_admin_or_socio(auth.uid()));

-- Storage RLS policies for announcement-attachments bucket
CREATE POLICY "Approved users can view announcement attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-attachments' AND is_approved(auth.uid()));

CREATE POLICY "Admins can upload announcement attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-attachments' AND is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete announcement attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcement-attachments' AND is_admin_or_socio(auth.uid()));
