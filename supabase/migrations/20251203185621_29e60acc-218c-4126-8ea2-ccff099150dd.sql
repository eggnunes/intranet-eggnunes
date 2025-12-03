
-- Add recruitment permission to admin_permissions table
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_recruitment TEXT NOT NULL DEFAULT 'none';
