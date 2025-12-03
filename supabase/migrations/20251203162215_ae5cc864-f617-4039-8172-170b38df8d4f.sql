-- Add category column to food_items
ALTER TABLE public.food_items ADD COLUMN category text DEFAULT 'outros';

-- Create food purchase status table for admin decisions
CREATE TABLE public.food_purchase_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id uuid REFERENCES public.food_items(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  decided_by uuid,
  decided_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(food_item_id, week_start)
);

-- Enable RLS
ALTER TABLE public.food_purchase_status ENABLE ROW LEVEL SECURITY;

-- Policies for food_purchase_status
CREATE POLICY "Approved users can view purchase status"
ON public.food_purchase_status
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.approval_status = 'approved'
));

CREATE POLICY "Admins can manage purchase status"
ON public.food_purchase_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to update food items (for editing name/category)
CREATE POLICY "Admins can update food items"
ON public.food_items
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to delete food items
CREATE POLICY "Admins can delete food items"
ON public.food_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_food_purchase_status_week ON public.food_purchase_status(week_start);
CREATE INDEX idx_food_items_category ON public.food_items(category);