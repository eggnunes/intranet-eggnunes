-- Corrigir a função protect_rafael_admin para retornar NEW em updates normais
CREATE OR REPLACE FUNCTION public.protect_rafael_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Impedir exclusão ou update de status de Rafael
  IF OLD.email = 'rafael@eggnunes.com.br' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Não é possível remover o criador da intranet';
    END IF;
    -- Para updates no Rafael, impedir mudança de approval_status
    IF TG_OP = 'UPDATE' AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      RAISE EXCEPTION 'Não é possível modificar o status do criador da intranet';
    END IF;
  END IF;
  
  -- Para deletes retorna OLD, para updates retorna NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;