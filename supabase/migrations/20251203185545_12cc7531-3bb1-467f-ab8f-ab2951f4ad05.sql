
-- Enum for recruitment stages
CREATE TYPE public.recruitment_stage AS ENUM (
  'curriculo_recebido',
  'entrevista_agendada',
  'entrevista_realizada',
  'aguardando_prova',
  'prova_realizada',
  'entrevista_presencial_agendada',
  'entrevista_presencial_realizada',
  'contratado',
  'eliminado'
);

-- Enum for elimination reasons
CREATE TYPE public.elimination_reason AS ENUM (
  'sem_interesse_candidato',
  'sem_interesse_escritorio',
  'reprovado_entrevista',
  'reprovado_prova',
  'reprovado_entrevista_presencial',
  'outro'
);

-- Main candidates table
CREATE TABLE public.recruitment_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position_applied TEXT,
  resume_url TEXT,
  resume_file_name TEXT,
  current_stage recruitment_stage NOT NULL DEFAULT 'curriculo_recebido',
  is_active BOOLEAN NOT NULL DEFAULT true,
  elimination_reason elimination_reason,
  elimination_notes TEXT,
  interview_date TIMESTAMP WITH TIME ZONE,
  test_date TIMESTAMP WITH TIME ZONE,
  test_score NUMERIC,
  in_person_interview_date TIMESTAMP WITH TIME ZONE,
  hired_date DATE,
  extracted_data JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stage history table
CREATE TABLE public.recruitment_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.recruitment_candidates(id) ON DELETE CASCADE,
  from_stage recruitment_stage,
  to_stage recruitment_stage NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notes/observations table
CREATE TABLE public.recruitment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.recruitment_candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruitment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recruitment_candidates
CREATE POLICY "Admins podem ver todos os candidatos"
ON public.recruitment_candidates FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar candidatos"
ON public.recruitment_candidates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar candidatos"
ON public.recruitment_candidates FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar candidatos"
ON public.recruitment_candidates FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for recruitment_stage_history
CREATE POLICY "Admins podem ver histórico"
ON public.recruitment_stage_history FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar histórico"
ON public.recruitment_stage_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for recruitment_notes
CREATE POLICY "Admins podem ver notas"
ON public.recruitment_notes FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar notas"
ON public.recruitment_notes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar notas"
ON public.recruitment_notes FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar notas"
ON public.recruitment_notes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_recruitment_candidates_updated_at
BEFORE UPDATE ON public.recruitment_candidates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recruitment_notes_updated_at
BEFORE UPDATE ON public.recruitment_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);

-- Storage policies for resumes
CREATE POLICY "Admins podem ver currículos"
ON storage.objects FOR SELECT
USING (bucket_id = 'resumes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem fazer upload de currículos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resumes' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar currículos"
ON storage.objects FOR DELETE
USING (bucket_id = 'resumes' AND has_role(auth.uid(), 'admin'));
