-- Create admin permissions table with granular control
CREATE TABLE public.admin_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL UNIQUE,
  -- Each permission has 3 levels: 'none', 'view', 'edit'
  perm_financial TEXT NOT NULL DEFAULT 'none' CHECK (perm_financial IN ('none', 'view', 'edit')),
  perm_users TEXT NOT NULL DEFAULT 'none' CHECK (perm_users IN ('none', 'view', 'edit')),
  perm_announcements TEXT NOT NULL DEFAULT 'none' CHECK (perm_announcements IN ('none', 'view', 'edit')),
  perm_suggestions TEXT NOT NULL DEFAULT 'none' CHECK (perm_suggestions IN ('none', 'view', 'edit')),
  perm_forum TEXT NOT NULL DEFAULT 'none' CHECK (perm_forum IN ('none', 'view', 'edit')),
  perm_documents TEXT NOT NULL DEFAULT 'none' CHECK (perm_documents IN ('none', 'view', 'edit')),
  perm_onboarding TEXT NOT NULL DEFAULT 'none' CHECK (perm_onboarding IN ('none', 'view', 'edit')),
  perm_events TEXT NOT NULL DEFAULT 'none' CHECK (perm_events IN ('none', 'view', 'edit')),
  perm_home_office TEXT NOT NULL DEFAULT 'none' CHECK (perm_home_office IN ('none', 'view', 'edit')),
  perm_vacation TEXT NOT NULL DEFAULT 'none' CHECK (perm_vacation IN ('none', 'view', 'edit')),
  perm_birthdays TEXT NOT NULL DEFAULT 'none' CHECK (perm_birthdays IN ('none', 'view', 'edit')),
  perm_copa_cozinha TEXT NOT NULL DEFAULT 'none' CHECK (perm_copa_cozinha IN ('none', 'view', 'edit')),
  perm_advbox TEXT NOT NULL DEFAULT 'none' CHECK (perm_advbox IN ('none', 'view', 'edit')),
  perm_collection TEXT NOT NULL DEFAULT 'none' CHECK (perm_collection IN ('none', 'view', 'edit')),
  perm_admin_requests TEXT NOT NULL DEFAULT 'none' CHECK (perm_admin_requests IN ('none', 'view', 'edit')),
  perm_task_rules TEXT NOT NULL DEFAULT 'none' CHECK (perm_task_rules IN ('none', 'view', 'edit')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Function to check if user is socio or rafael
CREATE OR REPLACE FUNCTION public.is_socio_or_rafael(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id 
    AND (
      position = 'socio' 
      OR email = 'rafael@eggnunes.com.br'
    )
  )
$$;

-- Function to get admin permission level for a feature
CREATE OR REPLACE FUNCTION public.get_admin_permission(_user_id uuid, _feature text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  permission_level TEXT;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = _user_id;
  
  -- Rafael and sócios have full access
  IF user_profile.email = 'rafael@eggnunes.com.br' OR user_profile.position = 'socio' THEN
    RETURN 'edit';
  END IF;
  
  -- Check if user is admin
  IF NOT has_role(_user_id, 'admin') THEN
    RETURN 'none';
  END IF;
  
  -- Get specific permission from admin_permissions table
  EXECUTE format('SELECT %I FROM public.admin_permissions WHERE admin_user_id = $1', 'perm_' || _feature)
  INTO permission_level
  USING _user_id;
  
  -- If no record exists, return 'none'
  RETURN COALESCE(permission_level, 'none');
END;
$$;

-- RLS policies
CREATE POLICY "Sócios e Rafael podem ver todas as permissões"
ON public.admin_permissions
FOR SELECT
USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Sócios e Rafael podem criar permissões"
ON public.admin_permissions
FOR INSERT
WITH CHECK (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Sócios e Rafael podem atualizar permissões"
ON public.admin_permissions
FOR UPDATE
USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Sócios e Rafael podem deletar permissões"
ON public.admin_permissions
FOR DELETE
USING (is_socio_or_rafael(auth.uid()));

-- Admins podem ver suas próprias permissões
CREATE POLICY "Admins podem ver suas próprias permissões"
ON public.admin_permissions
FOR SELECT
USING (admin_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index
CREATE INDEX idx_admin_permissions_admin_user_id ON public.admin_permissions(admin_user_id);