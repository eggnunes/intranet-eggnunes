-- Criar tabela de materiais de onboarding
CREATE TABLE public.onboarding_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  category TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.onboarding_materials ENABLE ROW LEVEL SECURITY;

-- Políticas para onboarding_materials
CREATE POLICY "Admins podem gerenciar materiais de onboarding"
ON public.onboarding_materials
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver materiais de onboarding"
ON public.onboarding_materials
FOR SELECT
USING (is_approved(auth.uid()));

-- Criar tabela de avisos (mural)
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('comunicado', 'evento', 'conquista')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Políticas para announcements
CREATE POLICY "Admins podem gerenciar avisos"
ON public.announcements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver avisos"
ON public.announcements
FOR SELECT
USING (is_approved(auth.uid()));

-- Criar tabela de eventos (galeria)
CREATE TABLE public.event_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.event_gallery ENABLE ROW LEVEL SECURITY;

-- Políticas para event_gallery
CREATE POLICY "Admins podem gerenciar eventos"
ON public.event_gallery
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver eventos"
ON public.event_gallery
FOR SELECT
USING (is_approved(auth.uid()));

-- Criar tabela de fotos de eventos
CREATE TABLE public.event_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.event_gallery(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Políticas para event_photos
CREATE POLICY "Admins podem gerenciar fotos de eventos"
ON public.event_photos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver fotos de eventos"
ON public.event_photos
FOR SELECT
USING (is_approved(auth.uid()));

-- Criar storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('onboarding-materials', 'onboarding-materials', false),
  ('announcement-attachments', 'announcement-attachments', false),
  ('event-photos', 'event-photos', true);

-- Políticas de storage para onboarding-materials
CREATE POLICY "Admins podem fazer upload de materiais de onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'onboarding-materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar materiais de onboarding"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'onboarding-materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar materiais de onboarding"
ON storage.objects
FOR DELETE
USING (bucket_id = 'onboarding-materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver materiais de onboarding"
ON storage.objects
FOR SELECT
USING (bucket_id = 'onboarding-materials' AND is_approved(auth.uid()));

-- Políticas de storage para announcement-attachments
CREATE POLICY "Admins podem fazer upload de anexos de avisos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'announcement-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar anexos de avisos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'announcement-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar anexos de avisos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'announcement-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver anexos de avisos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'announcement-attachments' AND is_approved(auth.uid()));

-- Políticas de storage para event-photos (público)
CREATE POLICY "Admins podem fazer upload de fotos de eventos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar fotos de eventos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'event-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar fotos de eventos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'event-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários aprovados podem ver fotos de eventos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-photos' AND is_approved(auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_onboarding_materials_updated_at
BEFORE UPDATE ON public.onboarding_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_gallery_updated_at
BEFORE UPDATE ON public.event_gallery
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();