-- Drop existing SELECT policies on vacation_requests
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações" ON public.vacation_requests;
DROP POLICY IF EXISTS "Admins podem ver todas as solicitações" ON public.vacation_requests;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações de férias" ON public.vacation_requests;

-- Create comprehensive SELECT policies
-- Users can see their own requests
CREATE POLICY "Usuários podem ver suas próprias solicitações de férias"
ON public.vacation_requests
FOR SELECT
USING (user_id = auth.uid());

-- Admins can see all requests
CREATE POLICY "Admins podem ver todas as solicitações de férias"
ON public.vacation_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));