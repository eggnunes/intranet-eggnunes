
-- Tabela de áreas de atuação dos parceiros
CREATE TABLE public.parceiros_areas_atuacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela principal de parceiros
CREATE TABLE public.parceiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  nome_escritorio TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  ranking INTEGER DEFAULT 0 CHECK (ranking >= 0 AND ranking <= 5),
  tipo TEXT NOT NULL CHECK (tipo IN ('indicamos', 'nos_indicam', 'ambos')),
  ativo BOOLEAN DEFAULT true,
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_inativacao TIMESTAMP WITH TIME ZONE,
  motivo_inativacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de relação parceiro x áreas de atuação (muitos para muitos)
CREATE TABLE public.parceiros_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.parceiros_areas_atuacao(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parceiro_id, area_id)
);

-- Tabela de indicações (casos indicados)
CREATE TABLE public.parceiros_indicacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  tipo_indicacao TEXT NOT NULL CHECK (tipo_indicacao IN ('enviada', 'recebida')),
  nome_cliente TEXT NOT NULL,
  descricao_caso TEXT,
  area_atuacao_id UUID REFERENCES public.parceiros_areas_atuacao(id),
  percentual_comissao NUMERIC(5,2) DEFAULT 0,
  valor_total_causa NUMERIC(15,2),
  valor_comissao NUMERIC(15,2),
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'fechada', 'cancelada')),
  data_indicacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de pagamentos de parceiros (integrada ao financeiro)
CREATE TABLE public.parceiros_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  indicacao_id UUID REFERENCES public.parceiros_indicacoes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receber', 'pagar')),
  valor NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  forma_pagamento TEXT,
  parcela_atual INTEGER DEFAULT 1,
  total_parcelas INTEGER DEFAULT 1,
  observacoes TEXT,
  lancamento_financeiro_id UUID REFERENCES public.fin_lancamentos(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.parceiros_areas_atuacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_pagamentos ENABLE ROW LEVEL SECURITY;

-- Policies para usuários aprovados
CREATE POLICY "Usuários aprovados podem ver áreas" ON public.parceiros_areas_atuacao
  FOR SELECT USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem gerenciar áreas" ON public.parceiros_areas_atuacao
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários aprovados podem ver parceiros" ON public.parceiros
  FOR SELECT USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem gerenciar parceiros" ON public.parceiros
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários aprovados podem ver parceiros_areas" ON public.parceiros_areas
  FOR SELECT USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem gerenciar parceiros_areas" ON public.parceiros_areas
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários aprovados podem ver indicações" ON public.parceiros_indicacoes
  FOR SELECT USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem gerenciar indicações" ON public.parceiros_indicacoes
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários aprovados podem ver pagamentos parceiros" ON public.parceiros_pagamentos
  FOR SELECT USING (is_approved(auth.uid()));

CREATE POLICY "Admins podem gerenciar pagamentos parceiros" ON public.parceiros_pagamentos
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Triggers para updated_at
CREATE TRIGGER update_parceiros_areas_atuacao_updated_at
  BEFORE UPDATE ON public.parceiros_areas_atuacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parceiros_updated_at
  BEFORE UPDATE ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parceiros_indicacoes_updated_at
  BEFORE UPDATE ON public.parceiros_indicacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parceiros_pagamentos_updated_at
  BEFORE UPDATE ON public.parceiros_pagamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para sincronizar pagamento de parceiro com financeiro
CREATE OR REPLACE FUNCTION public.sync_parceiro_pagamento_to_financeiro()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id UUID;
  v_parceiro_nome TEXT;
  v_lancamento_id UUID;
BEGIN
  -- Buscar nome do parceiro
  SELECT nome_completo INTO v_parceiro_nome FROM public.parceiros WHERE id = NEW.parceiro_id;
  
  -- Buscar ou criar categoria de parceiros
  IF NEW.tipo = 'receber' THEN
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'receita' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Receber)', 'receita', 'Receitas', '#22c55e', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  ELSE
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'despesa' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Pagar)', 'despesa', 'Despesas Operacionais', '#ef4444', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  END IF;
  
  -- Se já tem lançamento vinculado, atualizar
  IF NEW.lancamento_financeiro_id IS NOT NULL THEN
    UPDATE fin_lancamentos SET
      valor = NEW.valor,
      data_vencimento = NEW.data_vencimento,
      data_pagamento = NEW.data_pagamento,
      status = NEW.status,
      updated_at = NOW()
    WHERE id = NEW.lancamento_financeiro_id;
  ELSE
    -- Criar novo lançamento
    INSERT INTO fin_lancamentos (
      tipo,
      categoria_id,
      valor,
      descricao,
      data_vencimento,
      data_pagamento,
      origem,
      status,
      observacao,
      created_by
    ) VALUES (
      CASE WHEN NEW.tipo = 'receber' THEN 'receita' ELSE 'despesa' END,
      v_categoria_id,
      NEW.valor,
      'Comissão Parceiro: ' || v_parceiro_nome || 
        CASE WHEN NEW.total_parcelas > 1 THEN ' (' || NEW.parcela_atual || '/' || NEW.total_parcelas || ')' ELSE '' END,
      NEW.data_vencimento,
      NEW.data_pagamento,
      'cliente',
      NEW.status,
      NEW.observacoes,
      NEW.created_by
    )
    RETURNING id INTO v_lancamento_id;
    
    -- Vincular ao pagamento do parceiro
    NEW.lancamento_financeiro_id := v_lancamento_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_parceiro_pagamento_trigger
  BEFORE INSERT OR UPDATE ON public.parceiros_pagamentos
  FOR EACH ROW EXECUTE FUNCTION sync_parceiro_pagamento_to_financeiro();

-- Inserir algumas áreas de atuação padrão
INSERT INTO public.parceiros_areas_atuacao (nome, descricao) VALUES
  ('Trabalhista', 'Direito do Trabalho'),
  ('Tributário', 'Direito Tributário'),
  ('Criminal', 'Direito Penal'),
  ('Família', 'Direito de Família e Sucessões'),
  ('Consumidor', 'Direito do Consumidor'),
  ('Empresarial', 'Direito Empresarial'),
  ('Imobiliário', 'Direito Imobiliário'),
  ('Ambiental', 'Direito Ambiental'),
  ('Administrativo', 'Direito Administrativo'),
  ('Previdenciário', 'Direito Previdenciário');
