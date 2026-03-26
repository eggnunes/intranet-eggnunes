CREATE TABLE public.movement_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_title TEXT NOT NULL UNIQUE,
  translated_text TEXT,
  suggested_by_ai BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE movement_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view" ON movement_translations
  FOR SELECT TO authenticated USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can insert" ON movement_translations
  FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update" ON movement_translations
  FOR UPDATE TO authenticated USING (is_approved(auth.uid()));