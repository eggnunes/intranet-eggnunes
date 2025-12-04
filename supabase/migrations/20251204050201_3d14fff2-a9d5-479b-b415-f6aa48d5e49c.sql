-- Add fields to track future hire candidates and their previous job openings
ALTER TABLE public.recruitment_candidates 
ADD COLUMN IF NOT EXISTS previous_job_opening_id uuid REFERENCES public.recruitment_job_openings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_future_hire_candidate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS future_hire_notes text;

-- Add comment for clarity
COMMENT ON COLUMN public.recruitment_candidates.previous_job_opening_id IS 'Tracks which job opening the candidate previously participated in before being moved to talent pool';
COMMENT ON COLUMN public.recruitment_candidates.is_future_hire_candidate IS 'Flag indicating candidate is viable for future hiring';
COMMENT ON COLUMN public.recruitment_candidates.future_hire_notes IS 'Notes about why candidate is viable for future hiring';