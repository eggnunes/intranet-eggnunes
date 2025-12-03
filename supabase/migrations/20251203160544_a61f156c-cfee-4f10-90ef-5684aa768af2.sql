-- Tabela para alimentos cadastrados
CREATE TABLE public.food_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para sugestões semanais de alimentos
CREATE TABLE public.food_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  food_item_id UUID NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(food_item_id, user_id, week_start)
);

-- Enable RLS
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_suggestions ENABLE ROW LEVEL SECURITY;

-- Políticas para food_items (todos usuários aprovados podem ver e criar)
CREATE POLICY "Approved users can view food items"
ON public.food_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approval_status = 'approved'
  )
);

CREATE POLICY "Approved users can create food items"
ON public.food_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approval_status = 'approved'
  )
);

-- Políticas para food_suggestions
CREATE POLICY "Approved users can view food suggestions"
ON public.food_suggestions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approval_status = 'approved'
  )
);

CREATE POLICY "Users can create their own suggestions"
ON public.food_suggestions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
ON public.food_suggestions FOR DELETE
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_food_items_normalized_name ON public.food_items(normalized_name);
CREATE INDEX idx_food_suggestions_week_start ON public.food_suggestions(week_start);
CREATE INDEX idx_food_suggestions_food_item ON public.food_suggestions(food_item_id);