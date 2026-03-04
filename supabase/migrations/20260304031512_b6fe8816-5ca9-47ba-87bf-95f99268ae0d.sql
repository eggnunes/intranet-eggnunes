
-- Drop old user-only SELECT policies
DROP POLICY IF EXISTS "Usuários podem ver suas próprias pesquisas" ON public.jurisprudence_searches;
DROP POLICY IF EXISTS "Usuários podem ver suas jurisprudências salvas" ON public.saved_jurisprudence;

-- Create new policies allowing all approved users to read
CREATE POLICY "Usuários aprovados podem ver todas as pesquisas"
ON public.jurisprudence_searches
FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver todas as jurisprudências salvas"
ON public.saved_jurisprudence
FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));
