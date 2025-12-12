-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Approved users can view TOTP accounts" ON public.totp_accounts;

-- Create a new policy that only allows admins to see secret_key
-- Non-admins get access through the edge function only
CREATE POLICY "Only admins can view TOTP accounts directly"
ON public.totp_accounts FOR SELECT
USING (has_role(auth.uid(), 'admin'));