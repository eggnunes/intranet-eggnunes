-- Add lead_tracking permission column to admin_permissions
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS perm_lead_tracking text NOT NULL DEFAULT 'none'::text;

-- Add lead_tracking permission column to position_permission_defaults
ALTER TABLE public.position_permission_defaults 
ADD COLUMN IF NOT EXISTS perm_lead_tracking text NOT NULL DEFAULT 'none'::text;

-- Update position_permission_defaults to give only sócios access to lead tracking
UPDATE public.position_permission_defaults 
SET perm_lead_tracking = 'edit' 
WHERE position = 'socio';

-- Ensure all other positions have 'none' access
UPDATE public.position_permission_defaults 
SET perm_lead_tracking = 'none' 
WHERE position != 'socio';