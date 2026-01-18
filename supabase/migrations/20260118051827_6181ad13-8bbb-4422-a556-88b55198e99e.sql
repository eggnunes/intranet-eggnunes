-- Tabela para registrar adiantamentos de colaboradores
CREATE TABLE public.rh_adiantamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL,
  
  -- Tipo de adiantamento
  tipo_adiantamento TEXT NOT NULL CHECK (tipo_adiantamento IN ('salario', '13_salario', 'ferias', 'bonus', 'outro')),
  tipo_adiantamento_outro TEXT, -- Descrição quando tipo é 'outro'
  
  -- Valores
  valor NUMERIC NOT NULL,
  
  -- Pagamento
  conta_pagamento_id UUID REFERENCES public.fin_contas(id),
  data_adiantamento DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Desconto
  forma_desconto TEXT NOT NULL CHECK (forma_desconto IN ('parcela_unica', 'parcelado')),
  numero_parcelas INTEGER DEFAULT 1,
  valor_parcela NUMERIC,
  mes_inicio_desconto TEXT, -- Formato: YYYY-MM
  
  -- Controle de status
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'quitado', 'cancelado')),
  saldo_restante NUMERIC NOT NULL,
  
  -- Lançamento financeiro gerado
  lancamento_financeiro_id UUID,
  
  -- Observações
  observacoes TEXT,
  
  -- Auditoria
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para registrar descontos aplicados de adiantamentos
CREATE TABLE public.rh_adiantamento_descontos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  adiantamento_id UUID NOT NULL REFERENCES public.rh_adiantamentos(id) ON DELETE CASCADE,
  pagamento_id UUID REFERENCES public.rh_pagamentos(id),
  
  -- Valores
  parcela_numero INTEGER NOT NULL,
  valor_descontado NUMERIC NOT NULL,
  
  -- Datas
  mes_referencia TEXT NOT NULL, -- Formato: YYYY-MM
  data_desconto DATE,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.rh_adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_adiantamento_descontos ENABLE ROW LEVEL SECURITY;

-- Políticas para rh_adiantamentos
CREATE POLICY "Admins podem gerenciar adiantamentos" 
ON public.rh_adiantamentos 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver adiantamentos" 
ON public.rh_adiantamentos 
FOR SELECT 
USING (is_approved(auth.uid()));

-- Políticas para rh_adiantamento_descontos
CREATE POLICY "Admins podem gerenciar descontos de adiantamentos" 
ON public.rh_adiantamento_descontos 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários aprovados podem ver descontos de adiantamentos" 
ON public.rh_adiantamento_descontos 
FOR SELECT 
USING (is_approved(auth.uid()));

-- Índices para melhorar performance
CREATE INDEX idx_rh_adiantamentos_colaborador ON public.rh_adiantamentos(colaborador_id);
CREATE INDEX idx_rh_adiantamentos_status ON public.rh_adiantamentos(status);
CREATE INDEX idx_rh_adiantamento_descontos_adiantamento ON public.rh_adiantamento_descontos(adiantamento_id);
CREATE INDEX idx_rh_adiantamento_descontos_pagamento ON public.rh_adiantamento_descontos(pagamento_id);

-- Função para verificar adiantamentos pendentes de um colaborador
CREATE OR REPLACE FUNCTION public.get_adiantamentos_pendentes(p_colaborador_id UUID)
RETURNS TABLE (
  id UUID,
  tipo_adiantamento TEXT,
  valor_original NUMERIC,
  saldo_restante NUMERIC,
  data_adiantamento DATE,
  mes_inicio_desconto TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.tipo_adiantamento,
    a.valor,
    a.saldo_restante,
    a.data_adiantamento,
    a.mes_inicio_desconto
  FROM public.rh_adiantamentos a
  WHERE a.colaborador_id = p_colaborador_id
    AND a.status = 'ativo'
    AND a.saldo_restante > 0
  ORDER BY a.data_adiantamento;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;