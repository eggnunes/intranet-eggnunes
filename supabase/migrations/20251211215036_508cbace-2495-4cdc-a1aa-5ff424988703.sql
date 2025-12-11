-- Update position_permission_defaults to give 'comercial' full CRM access by default
UPDATE public.position_permission_defaults 
SET perm_lead_tracking = 'edit'
WHERE position = 'comercial';

-- Also ensure 'socio' has full access
UPDATE public.position_permission_defaults 
SET perm_lead_tracking = 'edit'
WHERE position = 'socio';

-- Verify TOTP accounts RLS policies are correct
-- Drop and recreate to ensure proper setup

-- First drop existing policies
DROP POLICY IF EXISTS "Approved users can view TOTP accounts" ON public.totp_accounts;
DROP POLICY IF EXISTS "Admins can insert TOTP accounts" ON public.totp_accounts;
DROP POLICY IF EXISTS "Admins can update TOTP accounts" ON public.totp_accounts;
DROP POLICY IF EXISTS "Admins can delete TOTP accounts" ON public.totp_accounts;

-- Recreate with correct permissions
-- All approved users can view
CREATE POLICY "Approved users can view TOTP accounts"
ON public.totp_accounts
FOR SELECT
USING (is_approved(auth.uid()));

-- Only admins can insert
CREATE POLICY "Admins can insert TOTP accounts"
ON public.totp_accounts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update TOTP accounts"
ON public.totp_accounts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete TOTP accounts"
ON public.totp_accounts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));