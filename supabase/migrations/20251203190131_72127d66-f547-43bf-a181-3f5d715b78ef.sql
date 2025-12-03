
-- Job openings / selective processes table
CREATE TABLE public.recruitment_job_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  position TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paused')),
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add job_opening_id to candidates table
ALTER TABLE public.recruitment_candidates 
ADD COLUMN job_opening_id UUID REFERENCES public.recruitment_job_openings(id) ON DELETE SET NULL;

-- Candidate extra documents table
CREATE TABLE public.recruitment_candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.recruitment_candidates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT NOT NULL DEFAULT 'outro',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Interview scheduling table
CREATE TABLE public.recruitment_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.recruitment_candidates(id) ON DELETE CASCADE,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('online', 'presencial')),
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_link TEXT,
  interviewer_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruitment_job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_interviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recruitment_job_openings
CREATE POLICY "Admins podem ver vagas"
ON public.recruitment_job_openings FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar vagas"
ON public.recruitment_job_openings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar vagas"
ON public.recruitment_job_openings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar vagas"
ON public.recruitment_job_openings FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for recruitment_candidate_documents
CREATE POLICY "Admins podem ver documentos"
ON public.recruitment_candidate_documents FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar documentos"
ON public.recruitment_candidate_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar documentos"
ON public.recruitment_candidate_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for recruitment_interviews
CREATE POLICY "Admins podem ver entrevistas"
ON public.recruitment_interviews FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar entrevistas"
ON public.recruitment_interviews FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar entrevistas"
ON public.recruitment_interviews FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar entrevistas"
ON public.recruitment_interviews FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_recruitment_job_openings_updated_at
BEFORE UPDATE ON public.recruitment_job_openings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recruitment_interviews_updated_at
BEFORE UPDATE ON public.recruitment_interviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
