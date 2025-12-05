-- Drop the existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Usuários podem criar suas próprias solicitações de férias" ON public.vacation_requests;

-- Create new INSERT policy that allows:
-- 1. Users to create requests for themselves
-- 2. Admins to create requests for any user (for retroactive vacation registration)
CREATE POLICY "Usuários e admins podem criar solicitações de férias" 
ON public.vacation_requests 
FOR INSERT 
WITH CHECK (
  -- Users can create for themselves if approved
  ((user_id = auth.uid()) AND is_approved(auth.uid()))
  OR
  -- Admins can create for any user
  has_role(auth.uid(), 'admin'::app_role)
);