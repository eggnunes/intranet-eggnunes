CREATE OR REPLACE FUNCTION public.get_admin_permission(_user_id uuid, _feature text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  permission_level TEXT;
  user_position TEXT;
BEGIN
  SELECT * INTO user_profile FROM public.profiles WHERE id = _user_id;
  
  IF user_profile.email = 'rafael@eggnunes.com.br' OR user_profile.position = 'socio' THEN
    RETURN 'edit';
  END IF;
  
  IF has_role(_user_id, 'admin') THEN
    EXECUTE format('SELECT %I FROM public.admin_permissions WHERE admin_user_id = $1', 'perm_' || _feature)
    INTO permission_level
    USING _user_id;
    
    IF permission_level IS NOT NULL THEN
      RETURN permission_level;
    END IF;
    
    EXECUTE format('SELECT %I FROM public.position_permission_defaults WHERE is_admin_group = true LIMIT 1', 'perm_' || _feature)
    INTO permission_level;
    
    RETURN COALESCE(permission_level, 'edit');
  END IF;
  
  user_position := user_profile.position;
  
  IF user_position IS NOT NULL THEN
    EXECUTE format('SELECT %I FROM public.position_permission_defaults WHERE position = $1 LIMIT 1', 'perm_' || _feature)
    INTO permission_level
    USING user_position;
    
    IF permission_level IS NOT NULL THEN
      RETURN permission_level;
    END IF;
  END IF;
  
  RETURN 'none';
END;
$function$;