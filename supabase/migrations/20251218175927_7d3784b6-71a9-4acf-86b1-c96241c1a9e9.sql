-- Adicionar política para permitir que usuários aprovados vejam perfis de outros usuários aprovados
CREATE POLICY "Usuários aprovados podem ver perfis de aprovados"
ON public.profiles
FOR SELECT
USING (
  -- O usuário logado deve estar aprovado
  is_approved(auth.uid())
  AND
  -- O perfil sendo visualizado deve estar aprovado
  approval_status = 'approved'
);