-- Add new tracking fields to crm_contacts for Fonte and Campanha from RD Station
ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS traffic_source text,
ADD COLUMN IF NOT EXISTS traffic_medium text,
ADD COLUMN IF NOT EXISTS traffic_campaign text;

-- Add comments for documentation
COMMENT ON COLUMN public.crm_contacts.traffic_source IS 'Fonte do lead (e.g., Busca Paga | Facebook)';
COMMENT ON COLUMN public.crm_contacts.traffic_medium IS 'Meio de tráfego';
COMMENT ON COLUMN public.crm_contacts.traffic_campaign IS 'Nome da campanha de tráfego';