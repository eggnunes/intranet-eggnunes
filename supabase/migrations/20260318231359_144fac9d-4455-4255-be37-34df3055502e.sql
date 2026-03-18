
CREATE TABLE public.marketing_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view marketing publications"
  ON public.marketing_publications FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Authenticated users can insert marketing publications"
  ON public.marketing_publications FOR INSERT TO authenticated
  WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Users can update own marketing publications"
  ON public.marketing_publications FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own marketing publications"
  ON public.marketing_publications FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
