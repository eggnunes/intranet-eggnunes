-- Create user access tracking table
CREATE TABLE public.user_access_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  page_name TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for user_id + page_path
CREATE UNIQUE INDEX idx_user_access_tracking_user_page ON public.user_access_tracking(user_id, page_path);

-- Create index for faster queries
CREATE INDEX idx_user_access_tracking_user_id ON public.user_access_tracking(user_id);
CREATE INDEX idx_user_access_tracking_access_count ON public.user_access_tracking(access_count DESC);

-- Enable Row Level Security
ALTER TABLE public.user_access_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own access data
CREATE POLICY "Users can view their own access tracking" 
ON public.user_access_tracking 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own access data
CREATE POLICY "Users can insert their own access tracking" 
ON public.user_access_tracking 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own access data
CREATE POLICY "Users can update their own access tracking" 
ON public.user_access_tracking 
FOR UPDATE 
USING (auth.uid() = user_id);