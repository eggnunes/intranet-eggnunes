
-- Central de Automações WhatsApp
CREATE TABLE public.whatsapp_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  message_template TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  send_via TEXT NOT NULL DEFAULT 'zapi',
  interval_seconds INTEGER NOT NULL DEFAULT 120,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

-- Leitura para todos aprovados
CREATE POLICY "Approved users can view automation rules"
  ON public.whatsapp_automation_rules FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- Escrita apenas para admins
CREATE POLICY "Admins can insert automation rules"
  ON public.whatsapp_automation_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can update automation rules"
  ON public.whatsapp_automation_rules FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete automation rules"
  ON public.whatsapp_automation_rules FOR DELETE
  TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

-- Trigger de updated_at
CREATE TRIGGER update_whatsapp_automation_rules_updated_at
  BEFORE UPDATE ON public.whatsapp_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Seed: automação de aniversário ativa via Z-API
INSERT INTO public.whatsapp_automation_rules (name, type, message_template, is_active, send_via, interval_seconds)
VALUES (
  'Aniversário de Clientes',
  'birthday',
  'Olá, {nome}! 🎂

O escritório Egg Nunes Advogados deseja a você um Feliz Aniversário! 🎉

Que este novo ciclo seja repleto de conquistas, saúde e realizações.

Um grande abraço de toda a nossa equipe! 🤗',
  true,
  'zapi',
  120
);
