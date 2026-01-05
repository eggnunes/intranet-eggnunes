-- Tabela para armazenar histórico de QR Codes gerados
CREATE TABLE public.qr_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID NOT NULL,
    qr_code_data TEXT NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem visualizar todos os QR codes
CREATE POLICY "Todos podem visualizar QR codes" 
ON public.qr_codes 
FOR SELECT 
TO authenticated
USING (true);

-- Usuários autenticados podem criar QR codes
CREATE POLICY "Usuários podem criar QR codes" 
ON public.qr_codes 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Apenas admins (sócios ou rafael) podem deletar
CREATE POLICY "Apenas admins podem deletar QR codes" 
ON public.qr_codes 
FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (position = 'socio' OR email = 'rafael@eggnunes.com.br')
    )
);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_codes;