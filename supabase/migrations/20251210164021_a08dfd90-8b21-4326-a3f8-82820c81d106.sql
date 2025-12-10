-- Tabela de campanhas UTM
CREATE TABLE public.utm_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  base_url TEXT NOT NULL,
  whatsapp_number TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de formulários de captura
CREATE TABLE public.lead_capture_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.utm_campaigns(id) ON DELETE SET NULL,
  whatsapp_number TEXT NOT NULL,
  whatsapp_message TEXT DEFAULT 'Olá! Gostaria de mais informações.',
  redirect_to_whatsapp BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de leads capturados
CREATE TABLE public.captured_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.lead_capture_forms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  landing_page TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  rd_station_synced BOOLEAN DEFAULT false,
  rd_station_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.utm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_capture_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for utm_campaigns
CREATE POLICY "Authenticated users can view campaigns" ON public.utm_campaigns
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create campaigns" ON public.utm_campaigns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own campaigns" ON public.utm_campaigns
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own campaigns" ON public.utm_campaigns
  FOR DELETE USING (auth.uid() = created_by);

-- RLS policies for lead_capture_forms
CREATE POLICY "Authenticated users can view forms" ON public.lead_capture_forms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create forms" ON public.lead_capture_forms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own forms" ON public.lead_capture_forms
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own forms" ON public.lead_capture_forms
  FOR DELETE USING (auth.uid() = created_by);

-- RLS policies for captured_leads (admin only view)
CREATE POLICY "Authenticated users can view leads" ON public.captured_leads
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Public insert for captured_leads (forms are public)
CREATE POLICY "Anyone can insert leads" ON public.captured_leads
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_captured_leads_form_id ON public.captured_leads(form_id);
CREATE INDEX idx_captured_leads_created_at ON public.captured_leads(created_at DESC);
CREATE INDEX idx_utm_campaigns_created_by ON public.utm_campaigns(created_by);