-- Create financial_alerts table to store alert configurations
CREATE TABLE IF NOT EXISTS public.financial_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('expense_limit', 'profit_margin_min', 'revenue_decline')),
  threshold_value DECIMAL(10, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('month', 'quarter', 'year')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.financial_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own alerts"
  ON public.financial_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts"
  ON public.financial_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON public.financial_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON public.financial_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_financial_alerts_updated_at
  BEFORE UPDATE ON public.financial_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();