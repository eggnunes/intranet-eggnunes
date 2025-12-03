-- Remover políticas restritivas de update e criar permissivas
DROP POLICY IF EXISTS "Admins podem atualizar qualquer perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

-- Criar políticas PERMISSIVE (padrão) para UPDATE
CREATE POLICY "Admins podem atualizar qualquer perfil" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());