-- Criar função para registrar atualizações automaticamente
CREATE OR REPLACE FUNCTION public.registrar_atualizacao_intranet(
  p_titulo TEXT,
  p_descricao TEXT,
  p_categoria TEXT DEFAULT 'feature',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.intranet_updates (title, description, category, created_by)
  VALUES (p_titulo, p_descricao, p_categoria, COALESCE(p_created_by, '00000000-0000-0000-0000-000000000000'))
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar atualização quando nova tabela de parceiros é populada pela primeira vez
-- (como sistema de parceiros já existe, vamos registrar agora)

-- Registrar a atualização do sistema de parceiros
INSERT INTO public.intranet_updates (title, description, category, created_by)
SELECT 
  'Sistema de Gestão de Parceiros',
  'Novo sistema completo para gestão de parceiros de indicação de causas. Cadastre parceiros, áreas de atuação, indicações e pagamentos com integração automática ao financeiro.',
  'feature',
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.intranet_updates WHERE title = 'Sistema de Gestão de Parceiros'
);