-- Tabela de solicitações de férias
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  business_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de saldo de férias
CREATE TABLE public.vacation_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 20,
  used_days INTEGER NOT NULL DEFAULT 0,
  available_days INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Tabela de solicitações administrativas
CREATE TABLE public.administrative_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('material', 'maintenance', 'it', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  handled_by UUID REFERENCES auth.users(id),
  handled_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies para vacation_requests
CREATE POLICY "Usuários podem ver suas próprias solicitações de férias"
ON public.vacation_requests FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem criar suas próprias solicitações de férias"
ON public.vacation_requests FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem atualizar suas solicitações pendentes"
ON public.vacation_requests FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins podem gerenciar todas as solicitações de férias"
ON public.vacation_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para vacation_balance
CREATE POLICY "Usuários podem ver seu próprio saldo de férias"
ON public.vacation_balance FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar saldos de férias"
ON public.vacation_balance FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para administrative_requests
CREATE POLICY "Usuários podem ver suas próprias solicitações administrativas"
ON public.administrative_requests FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem criar solicitações administrativas"
ON public.administrative_requests FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Usuários podem atualizar suas solicitações pendentes"
ON public.administrative_requests FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins podem gerenciar todas as solicitações administrativas"
ON public.administrative_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_vacation_requests_updated_at
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacation_balance_updated_at
BEFORE UPDATE ON public.vacation_balance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_administrative_requests_updated_at
BEFORE UPDATE ON public.administrative_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar saldo de férias ao aprovar solicitação
CREATE OR REPLACE FUNCTION public.update_vacation_balance_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a solicitação foi aprovada
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Extrai o ano da data de início
    DECLARE
      request_year INTEGER := EXTRACT(YEAR FROM NEW.start_date);
    BEGIN
      -- Cria ou atualiza o saldo de férias
      INSERT INTO public.vacation_balance (user_id, year, used_days, available_days)
      VALUES (NEW.user_id, request_year, NEW.business_days, 20 - NEW.business_days)
      ON CONFLICT (user_id, year)
      DO UPDATE SET
        used_days = vacation_balance.used_days + NEW.business_days,
        available_days = vacation_balance.available_days - NEW.business_days,
        updated_at = now();
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_balance_on_vacation_approval
AFTER UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_vacation_balance_on_approval();