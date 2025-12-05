-- Create table for intranet updates/changelog
CREATE TABLE public.intranet_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.intranet_updates ENABLE ROW LEVEL SECURITY;

-- Approved users can view updates
CREATE POLICY "Usuários aprovados podem ver atualizações"
ON public.intranet_updates
FOR SELECT
USING (is_approved(auth.uid()));

-- Only sócios and Rafael can manage updates
CREATE POLICY "Sócios e Rafael podem gerenciar atualizações"
ON public.intranet_updates
FOR ALL
USING (is_socio_or_rafael(auth.uid()));

-- Create table to track which updates users have read
CREATE TABLE public.intranet_update_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  update_id UUID NOT NULL REFERENCES public.intranet_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(update_id, user_id)
);

-- Enable RLS
ALTER TABLE public.intranet_update_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own reads
CREATE POLICY "Usuários podem ver suas próprias leituras"
ON public.intranet_update_reads
FOR SELECT
USING (user_id = auth.uid());

-- Users can mark updates as read
CREATE POLICY "Usuários podem marcar como lido"
ON public.intranet_update_reads
FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

-- Insert initial updates
INSERT INTO public.intranet_updates (title, description, category, created_by)
SELECT 
  'Sistema de Atualizações',
  'Agora você pode acompanhar todas as novidades da intranet através do ícone de sino no menu superior.',
  'feature',
  id
FROM public.profiles 
WHERE email = 'rafael@eggnunes.com.br'
LIMIT 1;