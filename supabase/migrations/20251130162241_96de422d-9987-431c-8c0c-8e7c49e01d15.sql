-- Criar tabela para configurações do Advbox
CREATE TABLE IF NOT EXISTS public.advbox_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_ttl_minutes INTEGER NOT NULL DEFAULT 5,
  delay_between_requests_ms INTEGER NOT NULL DEFAULT 500,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Inserir configuração padrão
INSERT INTO public.advbox_settings (cache_ttl_minutes, delay_between_requests_ms)
VALUES (5, 500)
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.advbox_settings ENABLE ROW LEVEL SECURITY;

-- Políticas: todos podem ler, apenas admins podem atualizar
CREATE POLICY "Todos podem ver configurações do Advbox"
  ON public.advbox_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins podem atualizar configurações do Advbox"
  ON public.advbox_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Trigger para atualizar timestamp
CREATE TRIGGER update_advbox_settings_updated_at
  BEFORE UPDATE ON public.advbox_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();