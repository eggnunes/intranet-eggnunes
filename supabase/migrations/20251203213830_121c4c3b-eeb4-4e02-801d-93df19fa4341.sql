-- Create position permission defaults table
CREATE TABLE public.position_permission_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL UNIQUE,
  is_admin_group boolean DEFAULT false,
  perm_financial text NOT NULL DEFAULT 'none',
  perm_users text NOT NULL DEFAULT 'none',
  perm_announcements text NOT NULL DEFAULT 'view',
  perm_suggestions text NOT NULL DEFAULT 'view',
  perm_forum text NOT NULL DEFAULT 'edit',
  perm_documents text NOT NULL DEFAULT 'view',
  perm_onboarding text NOT NULL DEFAULT 'view',
  perm_events text NOT NULL DEFAULT 'view',
  perm_home_office text NOT NULL DEFAULT 'view',
  perm_vacation text NOT NULL DEFAULT 'view',
  perm_birthdays text NOT NULL DEFAULT 'view',
  perm_copa_cozinha text NOT NULL DEFAULT 'edit',
  perm_advbox text NOT NULL DEFAULT 'view',
  perm_collection text NOT NULL DEFAULT 'none',
  perm_admin_requests text NOT NULL DEFAULT 'view',
  perm_task_rules text NOT NULL DEFAULT 'none',
  perm_recruitment text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.position_permission_defaults ENABLE ROW LEVEL SECURITY;

-- Only sócios and Rafael can manage group permissions
CREATE POLICY "Sócios e Rafael podem gerenciar permissões de grupo"
ON public.position_permission_defaults
FOR ALL
USING (is_socio_or_rafael(auth.uid()));

-- All approved users can view group permissions
CREATE POLICY "Usuários aprovados podem ver permissões de grupo"
ON public.position_permission_defaults
FOR SELECT
USING (is_approved(auth.uid()));

-- Insert default permissions for each position
-- Admin group (full access)
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('admin', true, 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit', 'edit');

-- Advogado group (access to their own data + common areas)
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('advogado', false, 'none', 'none', 'view', 'edit', 'edit', 'view', 'view', 'view', 'view', 'view', 'view', 'edit', 'view', 'none', 'view', 'none', 'none');

-- Estagiário group
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('estagiario', false, 'none', 'none', 'view', 'edit', 'edit', 'view', 'view', 'view', 'none', 'view', 'view', 'edit', 'view', 'none', 'view', 'none', 'none');

-- Comercial group
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('comercial', false, 'none', 'none', 'view', 'edit', 'edit', 'view', 'view', 'view', 'none', 'view', 'view', 'edit', 'view', 'none', 'view', 'none', 'none');

-- Administrativo group
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('administrativo', false, 'none', 'none', 'view', 'edit', 'edit', 'view', 'view', 'view', 'none', 'view', 'view', 'edit', 'none', 'none', 'view', 'none', 'none');

-- User (default for users without position)
INSERT INTO public.position_permission_defaults (position, is_admin_group, perm_financial, perm_users, perm_announcements, perm_suggestions, perm_forum, perm_documents, perm_onboarding, perm_events, perm_home_office, perm_vacation, perm_birthdays, perm_copa_cozinha, perm_advbox, perm_collection, perm_admin_requests, perm_task_rules, perm_recruitment)
VALUES ('user', false, 'none', 'none', 'view', 'edit', 'edit', 'view', 'view', 'view', 'none', 'view', 'view', 'edit', 'none', 'none', 'view', 'none', 'none');

-- Add trigger for updated_at
CREATE TRIGGER update_position_permission_defaults_updated_at
BEFORE UPDATE ON public.position_permission_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();