-- Criar função para impedir exclusão/remoção de admin do Rafael
CREATE OR REPLACE FUNCTION public.protect_rafael_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impedir exclusão ou update de status de Rafael
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.email = 'rafael@eggnunes.com.br' THEN
    RAISE EXCEPTION 'Não é possível remover ou modificar o criador da intranet';
  END IF;
  RETURN OLD;
END;
$$;

-- Criar trigger para proteger Rafael na tabela profiles
CREATE TRIGGER protect_rafael_profile
BEFORE DELETE OR UPDATE OF approval_status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_rafael_admin();

-- Criar trigger para proteger role de admin do Rafael
CREATE OR REPLACE FUNCTION public.protect_rafael_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rafael_email TEXT;
BEGIN
  -- Buscar email do usuário
  SELECT email INTO rafael_email FROM public.profiles WHERE id = OLD.user_id;
  
  -- Impedir remoção de admin role do Rafael
  IF TG_OP = 'DELETE' AND rafael_email = 'rafael@eggnunes.com.br' AND OLD.role = 'admin' THEN
    RAISE EXCEPTION 'Não é possível remover privilégios de admin do criador da intranet';
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER protect_rafael_admin_role_trigger
BEFORE DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_rafael_admin_role();