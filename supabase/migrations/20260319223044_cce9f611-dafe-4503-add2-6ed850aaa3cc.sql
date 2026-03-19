-- Update trigger to clear ALL notification preferences when user is deactivated/suspended
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
      notify_tasks = false,
      notify_approvals = false,
      notify_financial = false,
      notify_announcements = false,
      notify_vacation = false,
      notify_birthdays = false,
      notify_forum = false,
      notify_messages = false,
      notify_crm = false,
      updated_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;