-- Add perm_totp column to admin_permissions table
ALTER TABLE public.admin_permissions
ADD COLUMN perm_totp text NOT NULL DEFAULT 'none'::text;

-- Add perm_totp column to position_permission_defaults table
ALTER TABLE public.position_permission_defaults
ADD COLUMN perm_totp text NOT NULL DEFAULT 'view'::text;

-- Update position_permission_defaults to give 'view' access by default for all groups
UPDATE public.position_permission_defaults SET perm_totp = 'view';

-- Update admin group to have 'edit' permission
UPDATE public.position_permission_defaults SET perm_totp = 'edit' WHERE is_admin_group = true;

-- Create a function to get TOTP permission
CREATE OR REPLACE FUNCTION public.get_totp_permission(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  individual_perm text;
  user_position text;
  is_user_admin boolean;
  group_perm text;
BEGIN
  -- Check individual permission first
  SELECT perm_totp INTO individual_perm
  FROM admin_permissions
  WHERE admin_user_id = user_id;
  
  IF individual_perm IS NOT NULL THEN
    RETURN individual_perm;
  END IF;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = get_totp_permission.user_id AND ur.role = 'admin'
  ) INTO is_user_admin;
  
  IF is_user_admin THEN
    SELECT perm_totp INTO group_perm
    FROM position_permission_defaults
    WHERE is_admin_group = true
    LIMIT 1;
    RETURN COALESCE(group_perm, 'edit');
  END IF;
  
  -- Get user position
  SELECT position INTO user_position
  FROM profiles
  WHERE id = user_id;
  
  -- Get group permission based on position
  SELECT perm_totp INTO group_perm
  FROM position_permission_defaults
  WHERE position = user_position;
  
  RETURN COALESCE(group_perm, 'none');
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all TOTP account data" ON public.totp_accounts;
DROP POLICY IF EXISTS "Approved users can view TOTP account info" ON public.totp_accounts;

-- Create new policy using TOTP permission
CREATE POLICY "Users with TOTP permission can view accounts"
ON public.totp_accounts
FOR SELECT
USING (get_totp_permission(auth.uid()) IN ('view', 'edit'));

-- Update insert/update/delete policies to check for 'edit' permission
DROP POLICY IF EXISTS "Admins can insert TOTP accounts" ON public.totp_accounts;
DROP POLICY IF EXISTS "Admins can update TOTP accounts" ON public.totp_accounts;
DROP POLICY IF EXISTS "Admins can delete TOTP accounts" ON public.totp_accounts;

CREATE POLICY "Users with TOTP edit permission can insert"
ON public.totp_accounts
FOR INSERT
WITH CHECK (get_totp_permission(auth.uid()) = 'edit');

CREATE POLICY "Users with TOTP edit permission can update"
ON public.totp_accounts
FOR UPDATE
USING (get_totp_permission(auth.uid()) = 'edit');

CREATE POLICY "Users with TOTP edit permission can delete"
ON public.totp_accounts
FOR DELETE
USING (get_totp_permission(auth.uid()) = 'edit');