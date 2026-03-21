-- 1. system_updates table for tracking deployments/updates
CREATE TABLE IF NOT EXISTS public.system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  version text,
  category text DEFAULT 'update',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read system_updates"
  ON public.system_updates FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Admins can manage system_updates"
  ON public.system_updates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. user_read_updates table
CREATE TABLE IF NOT EXISTS public.user_read_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_id uuid NOT NULL REFERENCES public.system_updates(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(user_id, update_id)
);

ALTER TABLE public.user_read_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read_updates"
  ON public.user_read_updates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own read_updates"
  ON public.user_read_updates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. realtime_notifications table
CREATE TABLE IF NOT EXISTS public.realtime_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.realtime_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own realtime_notifications"
  ON public.realtime_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own realtime_notifications"
  ON public.realtime_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Approved users can insert realtime_notifications"
  ON public.realtime_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_approved(auth.uid()));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_notifications;