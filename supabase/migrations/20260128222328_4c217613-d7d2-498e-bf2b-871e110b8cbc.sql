-- Create table to track sync progress
CREATE TABLE IF NOT EXISTS public.advbox_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'financial',
  status TEXT NOT NULL DEFAULT 'idle', -- idle, running, completed, error
  last_offset INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_created INTEGER DEFAULT 0,
  total_updated INTEGER DEFAULT 0,
  total_skipped INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  months INTEGER DEFAULT 12,
  started_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sync_type)
);

-- Enable RLS
ALTER TABLE public.advbox_sync_status ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view
CREATE POLICY "Admins can view sync status"
ON public.advbox_sync_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_permissions
    WHERE admin_user_id = auth.uid()
    AND perm_financial IN ('view', 'edit')
  )
);

-- Policy for service role to update (edge functions)
CREATE POLICY "Service role can manage sync status"
ON public.advbox_sync_status
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert initial record
INSERT INTO public.advbox_sync_status (sync_type, status)
VALUES ('financial', 'idle')
ON CONFLICT (sync_type) DO NOTHING;