-- Corrigir search_path nas funções criadas anteriormente (sem fazer DROP)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_forum_topic_last_post()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forum_topics
  SET last_post_at = NEW.created_at
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;