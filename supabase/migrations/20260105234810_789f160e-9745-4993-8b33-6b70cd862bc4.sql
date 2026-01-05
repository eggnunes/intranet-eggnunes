-- Adicionar coluna perm_parceiros na tabela admin_permissions
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS perm_parceiros text DEFAULT 'view';

-- Adicionar coluna perm_parceiros na tabela position_permission_defaults
ALTER TABLE public.position_permission_defaults 
ADD COLUMN IF NOT EXISTS perm_parceiros text DEFAULT 'view';

-- Atualizar permissões padrão por grupo:
-- Admin: edit (pode tudo)
-- Comercial: edit (pode inativar)
-- Outros: view (só visualizar e cadastrar)
UPDATE public.position_permission_defaults 
SET perm_parceiros = 'edit' 
WHERE position IN ('admin', 'comercial');

UPDATE public.position_permission_defaults 
SET perm_parceiros = 'view' 
WHERE position NOT IN ('admin', 'comercial');