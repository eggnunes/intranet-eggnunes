-- Add acquisition period and sold days fields to vacation_requests
ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS acquisition_period_start date,
ADD COLUMN IF NOT EXISTS acquisition_period_end date,
ADD COLUMN IF NOT EXISTS sold_days integer DEFAULT 0;