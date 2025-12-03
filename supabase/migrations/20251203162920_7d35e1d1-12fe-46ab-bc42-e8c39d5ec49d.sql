-- Home office schedules (monthly schedule per lawyer)
CREATE TABLE public.home_office_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc.
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week, month, year)
);

-- Home office swap requests
CREATE TABLE public.home_office_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_original_date date NOT NULL,
  target_original_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.home_office_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_office_swap_requests ENABLE ROW LEVEL SECURITY;

-- Policies for home_office_schedules
CREATE POLICY "Approved users can view home office schedules"
ON public.home_office_schedules
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Admins can manage home office schedules"
ON public.home_office_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for home_office_swap_requests
CREATE POLICY "Users can view swap requests involving them"
ON public.home_office_swap_requests
FOR SELECT
USING (
  is_approved(auth.uid()) AND 
  (requester_id = auth.uid() OR target_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Lawyers can create swap requests"
ON public.home_office_swap_requests
FOR INSERT
WITH CHECK (
  is_approved(auth.uid()) AND 
  requester_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND position = 'advogado'
  )
);

CREATE POLICY "Target users can update swap requests"
ON public.home_office_swap_requests
FOR UPDATE
USING (target_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Requesters can delete pending requests"
ON public.home_office_swap_requests
FOR DELETE
USING (requester_id = auth.uid() AND status = 'pending');

-- Indexes
CREATE INDEX idx_home_office_schedules_month_year ON public.home_office_schedules(month, year);
CREATE INDEX idx_home_office_schedules_user ON public.home_office_schedules(user_id);
CREATE INDEX idx_home_office_swap_requests_status ON public.home_office_swap_requests(status);
CREATE INDEX idx_home_office_swap_requests_target ON public.home_office_swap_requests(target_id);