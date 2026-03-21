
-- Table to store Meta Ads credentials per user
CREATE TABLE public.meta_ads_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ad_account_id)
);

ALTER TABLE public.meta_ads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meta ads config"
  ON public.meta_ads_config FOR SELECT
  USING (public.is_approved(auth.uid()) AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can insert own meta ads config"
  ON public.meta_ads_config FOR INSERT
  WITH CHECK (public.is_approved(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users can update own meta ads config"
  ON public.meta_ads_config FOR UPDATE
  USING (public.is_approved(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Users can delete own meta ads config"
  ON public.meta_ads_config FOR DELETE
  USING (public.is_approved(auth.uid()) AND auth.uid() = user_id);

CREATE TRIGGER update_meta_ads_config_updated_at
  BEFORE UPDATE ON public.meta_ads_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
