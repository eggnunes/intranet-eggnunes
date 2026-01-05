
-- Create unified audit log table (if not exists)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela TEXT NOT NULL,
  registro_id UUID,
  acao TEXT NOT NULL,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID,
  usuario_nome TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario_id ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON public.audit_log(tabela);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;

-- Policy: only admin/socio can view
CREATE POLICY "Admins can view audit_log"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND (p.position = 'socio' OR p.email = 'rafael@eggnunes.com.br')
    )
  );

-- Policy: authenticated users can insert (for triggers and app logs)
CREATE POLICY "Authenticated can insert audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- Generic trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_trigger_fn() RETURNS TRIGGER AS $$
DECLARE
  v_usuario_nome TEXT;
  v_acao TEXT;
  v_descricao TEXT;
  v_usuario_id UUID;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criar';
    v_descricao := 'Registro criado em ' || TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'editar';
    v_descricao := 'Registro atualizado em ' || TG_TABLE_NAME;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluir';
    v_descricao := 'Registro excluído de ' || TG_TABLE_NAME;
  END IF;

  -- Get user id from record or auth
  IF TG_OP = 'DELETE' THEN
    v_usuario_id := auth.uid();
  ELSE
    BEGIN
      v_usuario_id := COALESCE(NEW.created_by, NEW.user_id, auth.uid());
    EXCEPTION WHEN undefined_column THEN
      v_usuario_id := auth.uid();
    END;
  END IF;

  -- Get user name
  SELECT full_name INTO v_usuario_nome
  FROM public.profiles
  WHERE id = v_usuario_id;

  INSERT INTO public.audit_log (
    tabela, 
    registro_id, 
    acao, 
    descricao,
    dados_anteriores, 
    dados_novos, 
    usuario_id, 
    usuario_nome
  )
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_acao,
    v_descricao,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_usuario_id,
    COALESCE(v_usuario_nome, 'Sistema')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit triggers to existing tables
DROP TRIGGER IF EXISTS audit_fin_lancamentos ON public.fin_lancamentos;
CREATE TRIGGER audit_fin_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_fin_contratos ON public.fin_contratos;
CREATE TRIGGER audit_fin_contratos
  AFTER INSERT OR UPDATE OR DELETE ON public.fin_contratos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_rh_pagamentos ON public.rh_pagamentos;
CREATE TRIGGER audit_rh_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.rh_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_announcements ON public.announcements;
CREATE TRIGGER audit_announcements
  AFTER INSERT OR UPDATE OR DELETE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_suggestions ON public.suggestions;
CREATE TRIGGER audit_suggestions
  AFTER INSERT OR UPDATE OR DELETE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_administrative_requests ON public.administrative_requests;
CREATE TRIGGER audit_administrative_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.administrative_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_crm_deals ON public.crm_deals;
CREATE TRIGGER audit_crm_deals
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_crm_contacts ON public.crm_contacts;
CREATE TRIGGER audit_crm_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_vacation_requests ON public.vacation_requests;
CREATE TRIGGER audit_vacation_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_event_gallery ON public.event_gallery;
CREATE TRIGGER audit_event_gallery
  AFTER INSERT OR UPDATE OR DELETE ON public.event_gallery
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_forum_topics ON public.forum_topics;
CREATE TRIGGER audit_forum_topics
  AFTER INSERT OR UPDATE OR DELETE ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
