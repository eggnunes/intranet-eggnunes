ALTER TABLE public.captured_leads 
  ADD COLUMN utm_placement text,
  ADD COLUMN utm_device text,
  ADD COLUMN utm_publisher text;