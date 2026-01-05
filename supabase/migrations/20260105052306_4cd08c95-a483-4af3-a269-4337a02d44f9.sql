-- Criar bucket para contratos se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para contratos
CREATE POLICY "Authenticated users can view contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update contracts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');