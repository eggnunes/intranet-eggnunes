
-- Update get_totp_permission function to grant 'view' access to ALL approved users
-- This ensures users without a defined position or missing from position_permission_defaults can still view TOTP codes
CREATE OR REPLACE FUNCTION public.get_totp_permission(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  individual_perm text;
  user_position text;
  is_user_admin boolean;
  is_user_approved boolean;
  group_perm text;
BEGIN
  -- First check if user is approved
  SELECT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = get_totp_permission.user_id 
    AND p.approval_status = 'approved'
  ) INTO is_user_approved;
  
  -- If not approved, no access
  IF NOT is_user_approved THEN
    RETURN 'none';
  END IF;

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
  IF user_position IS NOT NULL THEN
    SELECT perm_totp INTO group_perm
    FROM position_permission_defaults
    WHERE position = user_position;
    
    IF group_perm IS NOT NULL THEN
      RETURN group_perm;
    END IF;
  END IF;
  
  -- DEFAULT: All approved users can at least view TOTP codes
  RETURN 'view';
END;
$$;

-- Ensure home office schedules are viewable by ALL approved users (already should be, but let's verify/recreate)
DROP POLICY IF EXISTS "Approved users can view home office schedules" ON home_office_schedules;
CREATE POLICY "Approved users can view home office schedules"
  ON home_office_schedules
  FOR SELECT
  USING (is_approved(auth.uid()));
