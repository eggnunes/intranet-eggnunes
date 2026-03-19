-- Trigger function to clear sensitive notification preferences when user is deactivated or suspended
CREATE OR REPLACE FUNCTION public.sanitize_email_prefs_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.is_active = false AND OLD.is_active = true) OR
     (NEW.is_suspended = true AND OLD.is_suspended = false) THEN
    UPDATE public.email_notification_preferences
    SET 
      notify_financial = false,
      notify_crm = false,
      notify_approvals = false,
      updated_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_email_prefs_on_deactivation ON public.profiles;
CREATE TRIGGER trg_sanitize_email_prefs_on_deactivation
  AFTER UPDATE OF is_active, is_suspended ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_email_prefs_on_deactivation();