-- Add DELETE policy for admins on vacation_requests
CREATE POLICY "Admins podem deletar solicitações de férias"
ON public.vacation_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policy for admins on vacation_requests (if not exists)
DROP POLICY IF EXISTS "Admins podem atualizar solicitações de férias" ON public.vacation_requests;
CREATE POLICY "Admins podem atualizar solicitações de férias"
ON public.vacation_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));