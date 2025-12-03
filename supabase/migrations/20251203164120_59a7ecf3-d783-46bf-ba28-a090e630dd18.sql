-- Update RLS policy to allow all approved users to view schedules
DROP POLICY IF EXISTS "Approved users can view home office schedules" ON public.home_office_schedules;

CREATE POLICY "Approved users can view home office schedules" 
ON public.home_office_schedules 
FOR SELECT 
USING (is_approved(auth.uid()));

-- Update swap requests to allow all approved users to view
DROP POLICY IF EXISTS "Users can view swap requests involving them" ON public.home_office_swap_requests;

CREATE POLICY "All approved users can view swap requests" 
ON public.home_office_swap_requests 
FOR SELECT 
USING (is_approved(auth.uid()));