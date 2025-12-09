-- Tabela para armazenar modelos de documentos (procuração, contrato, declaração)
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('procuracao', 'contrato', 'declaracao')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem gerenciar
CREATE POLICY "Admins podem visualizar todos os modelos"
  ON public.document_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem criar modelos"
  ON public.document_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem atualizar modelos"
  ON public.document_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins podem deletar modelos"
  ON public.document_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Tabela para templates de poderes especiais da procuração
CREATE TABLE public.special_powers_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.special_powers_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para templates de poderes especiais
CREATE POLICY "Usuários podem ver seus próprios templates e os padrão"
  ON public.special_powers_templates
  FOR SELECT
  USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY "Usuários podem criar seus próprios templates"
  ON public.special_powers_templates
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar seus próprios templates"
  ON public.special_powers_templates
  FOR UPDATE
  USING (user_id = auth.uid() OR (is_default = true AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )));

CREATE POLICY "Usuários podem deletar seus próprios templates"
  ON public.special_powers_templates
  FOR DELETE
  USING (user_id = auth.uid() OR (is_default = true AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_special_powers_templates_updated_at
  BEFORE UPDATE ON public.special_powers_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();