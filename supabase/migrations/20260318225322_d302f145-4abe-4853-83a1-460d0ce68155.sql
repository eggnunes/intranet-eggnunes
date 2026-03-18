
CREATE TABLE public.crm_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'outro',
  type TEXT NOT NULL DEFAULT 'trafego',
  investment NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

-- All authenticated can view
CREATE POLICY "Authenticated users can view campaigns"
  ON public.crm_campaigns FOR SELECT
  TO authenticated
  USING (true);

-- Admins/sócios or creator can insert
CREATE POLICY "Admins and creators can insert campaigns"
  ON public.crm_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_socio(auth.uid()) OR auth.uid() = created_by
  );

-- Admins/sócios or creator can update
CREATE POLICY "Admins and creators can update campaigns"
  ON public.crm_campaigns FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_socio(auth.uid()) OR auth.uid() = created_by
  );

-- Admins/sócios or creator can delete
CREATE POLICY "Admins and creators can delete campaigns"
  ON public.crm_campaigns FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_socio(auth.uid()) OR auth.uid() = created_by
  );
