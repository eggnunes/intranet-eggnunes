ALTER TABLE public.intranet_agents 
  ADD COLUMN IF NOT EXISTS function_role TEXT,
  ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT 'purple',
  ADD COLUMN IF NOT EXISTS data_access TEXT[] DEFAULT '{}';