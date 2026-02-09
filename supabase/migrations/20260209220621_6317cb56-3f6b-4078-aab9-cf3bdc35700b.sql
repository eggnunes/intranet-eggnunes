
-- Table to store all synced ADVBox tasks
CREATE TABLE public.advbox_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advbox_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_users TEXT,
  assigned_user_ids JSONB,
  process_number TEXT,
  lawsuit_id INTEGER,
  task_type TEXT,
  task_type_id INTEGER,
  points INTEGER NOT NULL DEFAULT 1,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_advbox_tasks_status ON public.advbox_tasks(status);
CREATE INDEX idx_advbox_tasks_due_date ON public.advbox_tasks(due_date);
CREATE INDEX idx_advbox_tasks_assigned ON public.advbox_tasks USING gin(to_tsvector('simple', COALESCE(assigned_users, '')));
CREATE INDEX idx_advbox_tasks_assigned_text ON public.advbox_tasks(assigned_users);
CREATE INDEX idx_advbox_tasks_synced_at ON public.advbox_tasks(synced_at);

-- Sync status tracking table
CREATE TABLE public.advbox_tasks_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL DEFAULT 'full',
  last_offset INTEGER DEFAULT 0,
  total_synced INTEGER DEFAULT 0,
  total_count INTEGER,
  status TEXT NOT NULL DEFAULT 'idle',
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advbox_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advbox_tasks_sync_status ENABLE ROW LEVEL SECURITY;

-- Read access for approved users
CREATE POLICY "Approved users can read advbox tasks"
ON public.advbox_tasks FOR SELECT
USING (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can read sync status"
ON public.advbox_tasks_sync_status FOR SELECT
USING (public.is_approved(auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_advbox_tasks_updated_at
BEFORE UPDATE ON public.advbox_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_advbox_tasks_sync_updated_at
BEFORE UPDATE ON public.advbox_tasks_sync_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
