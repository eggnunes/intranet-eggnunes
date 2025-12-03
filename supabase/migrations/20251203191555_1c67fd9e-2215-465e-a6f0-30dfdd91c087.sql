-- Create table for position templates (reusable descriptions/requirements)
CREATE TABLE public.recruitment_position_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position text NOT NULL,
    description text,
    requirements text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(position)
);

-- Enable RLS
ALTER TABLE public.recruitment_position_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins podem ver templates" ON public.recruitment_position_templates
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar templates" ON public.recruitment_position_templates
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar templates" ON public.recruitment_position_templates
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar templates" ON public.recruitment_position_templates
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for interview feedback/evaluation
CREATE TABLE public.recruitment_interview_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL REFERENCES public.recruitment_interviews(id) ON DELETE CASCADE,
    evaluator_id uuid NOT NULL,
    
    -- Structured evaluation criteria (1-5 scale)
    technical_skills integer CHECK (technical_skills >= 1 AND technical_skills <= 5),
    communication integer CHECK (communication >= 1 AND communication <= 5),
    cultural_fit integer CHECK (cultural_fit >= 1 AND cultural_fit <= 5),
    problem_solving integer CHECK (problem_solving >= 1 AND problem_solving <= 5),
    experience integer CHECK (experience >= 1 AND experience <= 5),
    motivation integer CHECK (motivation >= 1 AND motivation <= 5),
    
    -- Overall rating and recommendation
    overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
    recommendation text CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
    
    -- Text feedback
    strengths text,
    weaknesses text,
    additional_notes text,
    
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(interview_id, evaluator_id)
);

-- Enable RLS
ALTER TABLE public.recruitment_interview_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins podem ver feedback" ON public.recruitment_interview_feedback
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar feedback" ON public.recruitment_interview_feedback
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar feedback" ON public.recruitment_interview_feedback
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar feedback" ON public.recruitment_interview_feedback
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));