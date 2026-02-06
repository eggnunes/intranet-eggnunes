-- Add foreign keys with unique names to avoid conflicts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_forum_topics_created_by_profiles') THEN
    ALTER TABLE public.forum_topics ADD CONSTRAINT fk_forum_topics_created_by_profiles FOREIGN KEY (created_by) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_forum_posts_created_by_profiles') THEN
    ALTER TABLE public.forum_posts ADD CONSTRAINT fk_forum_posts_created_by_profiles FOREIGN KEY (created_by) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_requests_user_id_profiles') THEN
    ALTER TABLE public.administrative_requests ADD CONSTRAINT fk_admin_requests_user_id_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_requests_handled_by_profiles') THEN
    ALTER TABLE public.administrative_requests ADD CONSTRAINT fk_admin_requests_handled_by_profiles FOREIGN KEY (handled_by) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Drop the old conflicting constraint if it points to auth.users
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_topics_created_by_fkey') THEN
    ALTER TABLE public.forum_topics DROP CONSTRAINT forum_topics_created_by_fkey;
  END IF;
END $$;