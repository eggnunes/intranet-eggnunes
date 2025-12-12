-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Authenticated users can view leads" ON captured_leads;

-- Create new policy that matches frontend permission check
CREATE POLICY "Users with lead_tracking permission can view leads" ON captured_leads
  FOR SELECT USING (
    get_admin_permission(auth.uid(), 'lead_tracking') IN ('view', 'edit')
  );