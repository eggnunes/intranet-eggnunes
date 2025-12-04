-- 3. Criar trigger para proteger campos sensíveis em UPDATE
DROP TRIGGER IF EXISTS protect_approval_fields ON public.profiles;
CREATE TRIGGER protect_approval_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_approval_status();