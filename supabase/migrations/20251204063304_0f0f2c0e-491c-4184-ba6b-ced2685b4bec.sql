-- Create table for favorited AI messages
CREATE TABLE public.ai_message_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_message_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own favorites"
  ON public.ai_message_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites"
  ON public.ai_message_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.ai_message_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
  ON public.ai_message_favorites
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_ai_message_favorites_user_id ON public.ai_message_favorites(user_id);
CREATE INDEX idx_ai_message_favorites_message_id ON public.ai_message_favorites(message_id);