-- Adicionar coluna de permissão para Microsoft Teams
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS perm_teams text NOT NULL DEFAULT 'view';

-- Adicionar na tabela de permissões por cargo
ALTER TABLE public.position_permission_defaults 
ADD COLUMN IF NOT EXISTS perm_teams text NOT NULL DEFAULT 'view';

-- Atualizar permissão padrão para cargos administrativos (sócios têm acesso total)
UPDATE public.position_permission_defaults 
SET perm_teams = 'edit' 
WHERE position = 'socio' OR is_admin_group = true;