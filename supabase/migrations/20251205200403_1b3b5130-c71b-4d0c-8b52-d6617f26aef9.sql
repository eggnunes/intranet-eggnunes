-- Drop existing foreign keys that point to auth.users
ALTER TABLE public.vacation_requests DROP CONSTRAINT IF EXISTS vacation_requests_user_id_fkey;
ALTER TABLE public.vacation_requests DROP CONSTRAINT IF EXISTS vacation_requests_approved_by_fkey;

-- Create foreign keys pointing to profiles
ALTER TABLE public.vacation_requests
ADD CONSTRAINT vacation_requests_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.vacation_requests
ADD CONSTRAINT vacation_requests_approved_by_fkey
FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;