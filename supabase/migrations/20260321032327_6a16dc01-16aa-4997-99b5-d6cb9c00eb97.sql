
-- Drop existing FKs that point to auth.users
ALTER TABLE public.jurisprudence_searches
DROP CONSTRAINT jurisprudence_searches_user_id_fkey;

ALTER TABLE public.saved_jurisprudence
DROP CONSTRAINT saved_jurisprudence_user_id_fkey;

-- Add new FKs pointing to profiles
ALTER TABLE public.jurisprudence_searches
ADD CONSTRAINT jurisprudence_searches_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.saved_jurisprudence
ADD CONSTRAINT saved_jurisprudence_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);
