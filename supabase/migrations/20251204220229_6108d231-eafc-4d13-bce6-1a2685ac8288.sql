-- CORREÇÃO DE SEGURANÇA CRÍTICA: Proteger campo approval_status

-- 1. Criar função que protege campos sensíveis de serem alterados pelo próprio usuário
CREATE OR REPLACE FUNCTION public.protect_approval_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não é um admin tentando fazer a atualização
  IF NOT has_role(auth.uid(), 'admin') THEN
    -- Impedir mudança de approval_status pelo próprio usuário
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar o status de aprovação';
    END IF;
    
    -- Impedir mudança de approved_at pelo próprio usuário
    IF OLD.approved_at IS DISTINCT FROM NEW.approved_at THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar a data de aprovação';
    END IF;
    
    -- Impedir mudança de approved_by pelo próprio usuário
    IF OLD.approved_by IS DISTINCT FROM NEW.approved_by THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar o aprovador';
    END IF;
    
    -- Impedir mudança de is_active pelo próprio usuário
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar o status de ativação';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Corrigir o status do Guilherme que foi auto-aprovado indevidamente
-- (fazendo ANTES de criar o trigger)
UPDATE public.profiles
SET 
  approval_status = 'pending',
  approved_at = NULL,
  approved_by = NULL
WHERE email = 'guilhermezardo@eggnunes.com.br';