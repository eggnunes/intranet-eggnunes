
-- Create table for favorable decisions
CREATE TABLE public.favorable_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_type TEXT NOT NULL, -- sentença, liminar, acórdão
  product_name TEXT NOT NULL, -- from RD Station CRM
  client_name TEXT NOT NULL, -- from Advbox
  client_id TEXT, -- Advbox customer ID
  lawsuit_id TEXT, -- Advbox lawsuit ID
  process_number TEXT, -- from Advbox
  court TEXT, -- tribunal
  court_division TEXT, -- vara ou câmara
  decision_date DATE NOT NULL,
  decision_link TEXT, -- link to decision in Teams
  observation TEXT,
  was_posted BOOLEAN DEFAULT false,
  evaluation_requested BOOLEAN DEFAULT false,
  was_evaluated BOOLEAN DEFAULT false,
  teams_row_index INTEGER, -- row index in Teams spreadsheet for sync
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.favorable_decisions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Approved users can view decisions"
ON public.favorable_decisions
FOR SELECT
USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can create decisions"
ON public.favorable_decisions
FOR INSERT
WITH CHECK (is_approved(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Approved users can update decisions"
ON public.favorable_decisions
FOR UPDATE
USING (is_approved(auth.uid()));

CREATE POLICY "Admins can delete decisions"
ON public.favorable_decisions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_favorable_decisions_updated_at
BEFORE UPDATE ON public.favorable_decisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorable_decisions;
