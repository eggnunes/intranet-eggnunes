-- Atualizar políticas de storage para event-photos
-- Permitir que usuários aprovados façam upload de fotos
DROP POLICY IF EXISTS "Admins podem fazer upload de fotos de eventos" ON storage.objects;

CREATE POLICY "Usuários aprovados podem fazer upload de fotos de eventos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-photos' AND is_approved(auth.uid()));

-- Atualizar políticas da tabela event_photos
-- Permitir que usuários aprovados insiram fotos
DROP POLICY IF EXISTS "Admins podem gerenciar fotos de eventos" ON public.event_photos;

CREATE POLICY "Admins podem deletar fotos de eventos"
ON public.event_photos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem adicionar fotos de eventos"
ON public.event_photos
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Usuários podem deletar suas próprias fotos"
ON public.event_photos
FOR DELETE
USING (uploaded_by = auth.uid());