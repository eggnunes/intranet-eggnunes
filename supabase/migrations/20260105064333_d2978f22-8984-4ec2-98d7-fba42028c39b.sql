
-- =============================================
-- MÓDULO DE RH - CARGOS, PAGAMENTOS E DOCUMENTOS
-- =============================================

-- 1. Tabela de cargos e salários
CREATE TABLE IF NOT EXISTS public.rh_cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  valor_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.rh_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver cargos" ON public.rh_cargos
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem inserir cargos" ON public.rh_cargos
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem editar cargos" ON public.rh_cargos
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem deletar cargos" ON public.rh_cargos
  FOR DELETE USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 2. Adicionar cargo_id e contrato ao perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contrato_associado_registrado BOOLEAN DEFAULT NULL;

-- 3. Tabela de rubricas de pagamento
CREATE TABLE IF NOT EXISTS public.rh_rubricas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vantagem', 'desconto')),
  descricao TEXT,
  is_active BOOLEAN DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_rubricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver rubricas" ON public.rh_rubricas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar rubricas" ON public.rh_rubricas
  FOR ALL USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 4. Inserir rubricas padrão
INSERT INTO public.rh_rubricas (nome, tipo, descricao, ordem) VALUES
  ('Honorários Mensais', 'vantagem', 'Pagamento mensal fixo', 1),
  ('Bonificação por Metas', 'vantagem', 'Bonificação por cumprimento de metas', 2),
  ('13º Salário / Gratificação Anual', 'vantagem', '13º salário para CLTs ou gratificação anual', 3),
  ('Distribuição de Lucro Trimestral', 'vantagem', 'Para advogados e sócios', 4),
  ('Reembolso', 'vantagem', 'Reembolso de despesas', 5),
  ('Férias', 'vantagem', 'Pagamento de férias (CLTs)', 6),
  ('Comissão', 'vantagem', 'Comissão para assistentes comerciais', 7),
  ('Comissão de Indicação', 'vantagem', 'Comissão por indicação de clientes', 8),
  ('Pró-Labore', 'vantagem', 'Para sócios', 9),
  ('Antecipação de Lucro', 'vantagem', 'Para sócios', 10),
  ('Distribuição de Lucro', 'vantagem', 'Para sócios', 11),
  ('Adiantamento', 'desconto', 'Desconto de adiantamentos', 12),
  ('IRPF', 'desconto', 'Imposto de Renda (CLTs)', 13),
  ('INSS', 'desconto', 'Contribuição INSS (CLTs)', 14),
  ('Vale Transporte', 'desconto', 'Desconto VT (CLTs)', 15)
ON CONFLICT (nome) DO NOTHING;

-- 5. Tabela de pagamentos de colaboradores
CREATE TABLE IF NOT EXISTS public.rh_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  mes_referencia DATE NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processado', 'pago')),
  total_vantagens DECIMAL(12,2) DEFAULT 0,
  total_descontos DECIMAL(12,2) DEFAULT 0,
  total_liquido DECIMAL(12,2) DEFAULT 0,
  data_pagamento DATE,
  observacoes TEXT,
  recibo_gerado BOOLEAN DEFAULT false,
  recibo_url TEXT,
  lancamento_financeiro_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(colaborador_id, mes_referencia)
);

ALTER TABLE public.rh_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos pagamentos" ON public.rh_pagamentos
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()) OR colaborador_id = auth.uid());

CREATE POLICY "Admins podem inserir pagamentos" ON public.rh_pagamentos
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem editar pagamentos" ON public.rh_pagamentos
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem deletar pagamentos" ON public.rh_pagamentos
  FOR DELETE USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 6. Tabela de itens do pagamento
CREATE TABLE IF NOT EXISTS public.rh_pagamento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id UUID NOT NULL,
  rubrica_id UUID NOT NULL,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_pagamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mesmas regras do pagamento pai" ON public.rh_pagamento_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rh_pagamentos p 
      WHERE p.id = pagamento_id 
      AND (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()) OR p.colaborador_id = auth.uid())
    )
  );

CREATE POLICY "Admins podem gerenciar itens" ON public.rh_pagamento_itens
  FOR ALL USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 7. Tabela de sugestões de valores
CREATE TABLE IF NOT EXISTS public.rh_sugestoes_valores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  rubrica_id UUID NOT NULL,
  valor_sugerido DECIMAL(12,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, rubrica_id)
);

ALTER TABLE public.rh_sugestoes_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver sugestões" ON public.rh_sugestoes_valores
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem gerenciar sugestões" ON public.rh_sugestoes_valores
  FOR ALL USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 8. Tabela de pastas de documentos
CREATE TABLE IF NOT EXISTS public.rh_pastas_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(colaborador_id, nome)
);

ALTER TABLE public.rh_pastas_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ou admin podem ver pastas" ON public.rh_pastas_documentos
  FOR SELECT USING (colaborador_id = auth.uid() OR has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem gerenciar pastas" ON public.rh_pastas_documentos
  FOR ALL USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 9. Tabela de documentos
CREATE TABLE IF NOT EXISTS public.rh_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  pasta_id UUID,
  nome TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.rh_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ou admin podem ver documentos" ON public.rh_documentos
  FOR SELECT USING (colaborador_id = auth.uid() OR has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Admins podem gerenciar documentos" ON public.rh_documentos
  FOR ALL USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

-- 10. Inserir cargos iniciais
INSERT INTO public.rh_cargos (nome, valor_base) VALUES
  ('Auxiliar Administrativo', 2000.00),
  ('Assistente Comercial', 1897.36),
  ('Júnior I', 3000.00),
  ('Júnior II', 3500.00),
  ('Júnior III', 4000.00),
  ('Pleno I', 4400.00),
  ('Pleno II', 4900.00),
  ('Sênior', 5600.00),
  ('Master', 6900.00),
  ('Sócio', 13000.00)
ON CONFLICT (nome) DO NOTHING;

-- 11. Adicionar permissão de pagamentos
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_payroll TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_payroll TEXT DEFAULT 'none';

-- 12. Bucket para documentos RH
INSERT INTO storage.buckets (id, name, public) VALUES ('rh-documents', 'rh-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 13. Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_pagamentos;
