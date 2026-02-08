
-- 1. Add sector column to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS sector text;

-- 2. Create whatsapp_internal_comments table
CREATE TABLE public.whatsapp_internal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_internal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view internal comments"
  ON public.whatsapp_internal_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert internal comments"
  ON public.whatsapp_internal_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own comments"
  ON public.whatsapp_internal_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Enable realtime for internal comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_internal_comments;

-- 3. Create whatsapp_comment_mentions table
CREATE TABLE public.whatsapp_comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.whatsapp_internal_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mentions"
  ON public.whatsapp_comment_mentions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert mentions"
  ON public.whatsapp_comment_mentions FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Create whatsapp_tags table
CREATE TABLE public.whatsapp_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6B7280',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tags"
  ON public.whatsapp_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tags"
  ON public.whatsapp_tags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tags"
  ON public.whatsapp_tags FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tags"
  ON public.whatsapp_tags FOR DELETE TO authenticated USING (true);

-- 5. Create whatsapp_conversation_tags table
CREATE TABLE public.whatsapp_conversation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.whatsapp_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

ALTER TABLE public.whatsapp_conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view conversation tags"
  ON public.whatsapp_conversation_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert conversation tags"
  ON public.whatsapp_conversation_tags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete conversation tags"
  ON public.whatsapp_conversation_tags FOR DELETE TO authenticated USING (true);

-- 6. Create whatsapp_conversation_assignees table
CREATE TABLE public.whatsapp_conversation_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.whatsapp_conversation_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignees"
  ON public.whatsapp_conversation_assignees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert assignees"
  ON public.whatsapp_conversation_assignees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete assignees"
  ON public.whatsapp_conversation_assignees FOR DELETE TO authenticated USING (true);

-- 7. Trigger: notify on WhatsApp comment mentions
CREATE OR REPLACE FUNCTION public.notify_whatsapp_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_content text;
  v_author_name text;
  v_contact_name text;
  v_conversation_phone text;
BEGIN
  -- Get comment content and author info
  SELECT wic.content, p.full_name
  INTO v_comment_content, v_author_name
  FROM whatsapp_internal_comments wic
  JOIN profiles p ON p.id = wic.author_id
  WHERE wic.id = NEW.comment_id;

  -- Get conversation info
  SELECT wc.contact_name, wc.phone
  INTO v_contact_name, v_conversation_phone
  FROM whatsapp_internal_comments wic
  JOIN whatsapp_conversations wc ON wc.id = wic.conversation_id
  WHERE wic.id = NEW.comment_id;

  -- Insert notification
  INSERT INTO user_notifications (user_id, title, message, type, action_url)
  VALUES (
    NEW.mentioned_user_id,
    'Você foi mencionado no WhatsApp',
    COALESCE(v_author_name, 'Alguém') || ' mencionou você em ' || COALESCE(v_contact_name, v_conversation_phone) || ': ' || LEFT(v_comment_content, 100),
    'whatsapp_mention',
    '/whatsapp-avisos'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_whatsapp_mention
  AFTER INSERT ON public.whatsapp_comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_mention();

-- 8. Trigger: notify on internal message mentions (messages table)
CREATE OR REPLACE FUNCTION public.notify_message_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_mentioned_name text;
  v_mentioned_id uuid;
  v_mention text;
  v_mentions text[];
BEGIN
  -- Only process if content contains @
  IF NEW.content IS NULL OR position('@' in NEW.content) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Extract all @mentions (words after @)
  FOR v_mention IN
    SELECT (regexp_matches(NEW.content, '@([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)', 'g'))[1]
  LOOP
    -- Try to find profile by full_name (case-insensitive)
    SELECT id INTO v_mentioned_id
    FROM profiles
    WHERE lower(full_name) = lower(v_mention)
    LIMIT 1;

    IF v_mentioned_id IS NOT NULL AND v_mentioned_id != NEW.sender_id THEN
      INSERT INTO user_notifications (user_id, title, message, type, action_url)
      VALUES (
        v_mentioned_id,
        'Você foi mencionado em uma mensagem',
        COALESCE(v_sender_name, 'Alguém') || ' mencionou você: ' || LEFT(NEW.content, 100),
        'message_mention',
        '/mensagens'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_message_mention
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_mention();
