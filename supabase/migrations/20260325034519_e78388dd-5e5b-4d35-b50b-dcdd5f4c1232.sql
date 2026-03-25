
CREATE TABLE crm_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts INTEGER NOT NULL,
  max_contracts INTEGER,
  value_per_contract NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read commission rules"
  ON crm_commission_rules FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Admins can manage commission rules"
  ON crm_commission_rules FOR ALL TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

INSERT INTO crm_commission_rules (min_contracts, max_contracts, value_per_contract) VALUES
  (1, 29, 75.00),
  (30, 44, 100.00),
  (45, NULL, 125.00);
