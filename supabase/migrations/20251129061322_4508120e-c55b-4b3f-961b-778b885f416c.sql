-- Corrigir função update_topic_last_post para ter search_path
CREATE OR REPLACE FUNCTION update_topic_last_post()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.forum_topics
  SET last_post_at = NEW.created_at
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;