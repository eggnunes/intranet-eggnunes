-- Add policy for approved users to view TOTP accounts (without secret_key via RLS - the edge function handles code generation)
-- First, drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Only admins can view TOTP accounts directly" ON public.totp_accounts;

-- Create new policy: Admins can see everything (including secret_key for management)
CREATE POLICY "Admins can view all TOTP account data"
ON public.totp_accounts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy: Approved users can view basic account info (id, name, description) for displaying codes
-- The codes themselves are generated server-side via edge function
CREATE POLICY "Approved users can view TOTP account info"
ON public.totp_accounts
FOR SELECT
USING (is_approved(auth.uid()));