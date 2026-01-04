
-- ========================================
-- SISTEMA FINANCEIRO V2 - ESTRUTURA COMPLETA
-- ========================================

-- Tabela de Contas Financeiras (Asaas, Banco Itaú, Caixa Local, Investimentos)
CREATE TABLE public.fin_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'corrente', 'poupanca', 'caixa', 'pagamentos', 'investimento'
  banco VARCHAR(100),
  agencia VARCHAR(20),
  numero_conta VARCHAR(30),
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  saldo_atual DECIMAL(15,2) DEFAULT 0,
  cor VARCHAR(20) DEFAULT '#3B82F6',
  icone VARCHAR(50) DEFAULT 'wallet',
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de Categorias (Receitas e Despesas)
CREATE TABLE public.fin_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  grupo VARCHAR(100), -- Agrupamento (Ex: Pessoal, Infraestrutura)
  descricao TEXT,
  cor VARCHAR(20) DEFAULT '#6B7280',
  icone VARCHAR(50) DEFAULT 'folder',
  ordem INTEGER DEFAULT 0,
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Subcategorias
CREATE TABLE public.fin_subcategorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES public.fin_categorias(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Setores
CREATE TABLE public.fin_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Clientes Financeiros (pode ser integrada com ADV-Box depois)
CREATE TABLE public.fin_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  cpf_cnpj VARCHAR(20),
  email VARCHAR(200),
  telefone VARCHAR(20),
  advbox_id VARCHAR(100), -- Para integração futura
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela Principal de Lançamentos
CREATE TABLE public.fin_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
  
  -- Relacionamentos
  categoria_id UUID REFERENCES public.fin_categorias(id),
  subcategoria_id UUID REFERENCES public.fin_subcategorias(id),
  conta_origem_id UUID NOT NULL REFERENCES public.fin_contas(id),
  conta_destino_id UUID REFERENCES public.fin_contas(id), -- Para transferências
  cliente_id UUID REFERENCES public.fin_clientes(id),
  setor_id UUID REFERENCES public.fin_setores(id),
  
  -- Valores
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  descricao TEXT NOT NULL,
  
  -- Datas
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  
  -- Diferenciação Cliente/Escritório (para despesas)
  origem VARCHAR(20) CHECK (origem IN ('escritorio', 'cliente')),
  
  -- Controle de Reembolso
  a_reembolsar BOOLEAN DEFAULT FALSE,
  reembolsada BOOLEAN DEFAULT FALSE,
  data_reembolso DATE,
  
  -- Campos Adicionais
  produto_id VARCHAR(100), -- RD Station
  numero_documento VARCHAR(100),
  conciliado BOOLEAN DEFAULT FALSE,
  conciliado_em TIMESTAMP WITH TIME ZONE,
  conciliacao_id VARCHAR(100),
  anexo_url TEXT,
  observacoes TEXT,
  
  -- Status
  status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'agendado')),
  
  -- Recorrência
  recorrente BOOLEAN DEFAULT FALSE,
  recorrencia_tipo VARCHAR(20), -- mensal, semanal, anual
  recorrencia_fim DATE,
  lancamento_pai_id UUID REFERENCES public.fin_lancamentos(id),
  
  -- Auditoria
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Auditoria Financeira
CREATE TABLE public.fin_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela VARCHAR(50) NOT NULL,
  registro_id UUID NOT NULL,
  acao VARCHAR(20) NOT NULL CHECK (acao IN ('criar', 'editar', 'deletar', 'restaurar')),
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Configurações Financeiras
CREATE TABLE public.fin_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR(100) NOT NULL UNIQUE,
  valor JSONB,
  descricao TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================
CREATE INDEX idx_fin_lancamentos_tipo ON public.fin_lancamentos(tipo);
CREATE INDEX idx_fin_lancamentos_data ON public.fin_lancamentos(data_lancamento);
CREATE INDEX idx_fin_lancamentos_categoria ON public.fin_lancamentos(categoria_id);
CREATE INDEX idx_fin_lancamentos_cliente ON public.fin_lancamentos(cliente_id);
CREATE INDEX idx_fin_lancamentos_conta ON public.fin_lancamentos(conta_origem_id);
CREATE INDEX idx_fin_lancamentos_origem ON public.fin_lancamentos(origem);
CREATE INDEX idx_fin_lancamentos_reembolso ON public.fin_lancamentos(a_reembolsar, reembolsada);
CREATE INDEX idx_fin_lancamentos_status ON public.fin_lancamentos(status);
CREATE INDEX idx_fin_lancamentos_created_by ON public.fin_lancamentos(created_by);
CREATE INDEX idx_fin_auditoria_tabela ON public.fin_auditoria(tabela, registro_id);
CREATE INDEX idx_fin_subcategorias_categoria ON public.fin_subcategorias(categoria_id);

-- ========================================
-- HABILITAR RLS
-- ========================================
ALTER TABLE public.fin_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_configuracoes ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS RLS - Usuários autenticados podem ver tudo (sistema interno)
-- ========================================

-- Contas
CREATE POLICY "Users can view all accounts" ON public.fin_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert accounts" ON public.fin_contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update accounts" ON public.fin_contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete accounts" ON public.fin_contas FOR DELETE TO authenticated USING (true);

-- Categorias
CREATE POLICY "Users can view all categories" ON public.fin_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert categories" ON public.fin_categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update categories" ON public.fin_categorias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete categories" ON public.fin_categorias FOR DELETE TO authenticated USING (true);

-- Subcategorias
CREATE POLICY "Users can view all subcategories" ON public.fin_subcategorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert subcategories" ON public.fin_subcategorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update subcategories" ON public.fin_subcategorias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete subcategories" ON public.fin_subcategorias FOR DELETE TO authenticated USING (true);

-- Setores
CREATE POLICY "Users can view all sectors" ON public.fin_setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert sectors" ON public.fin_setores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update sectors" ON public.fin_setores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete sectors" ON public.fin_setores FOR DELETE TO authenticated USING (true);

-- Clientes
CREATE POLICY "Users can view all clients" ON public.fin_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert clients" ON public.fin_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update clients" ON public.fin_clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete clients" ON public.fin_clientes FOR DELETE TO authenticated USING (true);

-- Lançamentos
CREATE POLICY "Users can view all transactions" ON public.fin_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert transactions" ON public.fin_lancamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update transactions" ON public.fin_lancamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete transactions" ON public.fin_lancamentos FOR DELETE TO authenticated USING (true);

-- Auditoria
CREATE POLICY "Users can view audit" ON public.fin_auditoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert audit" ON public.fin_auditoria FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

-- Configurações
CREATE POLICY "Users can view config" ON public.fin_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update config" ON public.fin_configuracoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can insert config" ON public.fin_configuracoes FOR INSERT TO authenticated WITH CHECK (true);

-- ========================================
-- TRIGGER PARA AUDITORIA AUTOMÁTICA
-- ========================================
CREATE OR REPLACE FUNCTION public.fin_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'criar', to_jsonb(NEW), COALESCE(NEW.created_by, auth.uid()));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'editar', to_jsonb(OLD), to_jsonb(NEW), COALESCE(NEW.updated_by, auth.uid()));
    NEW.updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'deletar', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar trigger nos lançamentos
CREATE TRIGGER fin_lancamentos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fin_audit_trigger();

-- ========================================
-- TRIGGER PARA ATUALIZAR SALDO DAS CONTAS
-- ========================================
CREATE OR REPLACE FUNCTION public.fin_update_saldo()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcula o saldo da conta de origem
  IF NEW.conta_origem_id IS NOT NULL THEN
    UPDATE public.fin_contas 
    SET saldo_atual = saldo_inicial + COALESCE((
      SELECT SUM(
        CASE 
          WHEN tipo = 'receita' AND conta_origem_id = NEW.conta_origem_id AND status = 'pago' THEN valor
          WHEN tipo = 'despesa' AND conta_origem_id = NEW.conta_origem_id AND status = 'pago' THEN -valor
          WHEN tipo = 'transferencia' AND conta_origem_id = NEW.conta_origem_id AND status = 'pago' THEN -valor
          WHEN tipo = 'transferencia' AND conta_destino_id = NEW.conta_origem_id AND status = 'pago' THEN valor
          ELSE 0
        END
      ) FROM public.fin_lancamentos WHERE deleted_at IS NULL
    ), 0),
    updated_at = NOW()
    WHERE id = NEW.conta_origem_id;
  END IF;
  
  -- Recalcula o saldo da conta de destino (para transferências)
  IF NEW.conta_destino_id IS NOT NULL THEN
    UPDATE public.fin_contas 
    SET saldo_atual = saldo_inicial + COALESCE((
      SELECT SUM(
        CASE 
          WHEN tipo = 'receita' AND conta_origem_id = NEW.conta_destino_id AND status = 'pago' THEN valor
          WHEN tipo = 'despesa' AND conta_origem_id = NEW.conta_destino_id AND status = 'pago' THEN -valor
          WHEN tipo = 'transferencia' AND conta_origem_id = NEW.conta_destino_id AND status = 'pago' THEN -valor
          WHEN tipo = 'transferencia' AND conta_destino_id = NEW.conta_destino_id AND status = 'pago' THEN valor
          ELSE 0
        END
      ) FROM public.fin_lancamentos WHERE deleted_at IS NULL
    ), 0),
    updated_at = NOW()
    WHERE id = NEW.conta_destino_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER fin_update_saldo_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fin_update_saldo();

-- ========================================
-- POPULAR DADOS INICIAIS
-- ========================================

-- Contas Iniciais
INSERT INTO public.fin_contas (nome, tipo, banco, cor, icone) VALUES
('Asaas', 'pagamentos', 'Asaas', '#10B981', 'credit-card'),
('Banco Itaú', 'corrente', 'Itaú Unibanco', '#FF6600', 'landmark'),
('Caixa Local', 'caixa', NULL, '#6366F1', 'wallet'),
('Investimentos', 'investimento', 'Itaú', '#8B5CF6', 'trending-up');

-- Categorias de Receita
INSERT INTO public.fin_categorias (nome, tipo, grupo, descricao, cor, ordem) VALUES
('Honorários Iniciais', 'receita', 'Honorários', 'Honorários cobrados no início do atendimento ao cliente', '#10B981', 1),
('Honorários Mensais', 'receita', 'Honorários', 'Honorários recorrentes mensais de clientes em regime de retainer', '#059669', 2),
('Honorários de Êxito', 'receita', 'Honorários', 'Honorários cobrados quando há êxito no caso', '#047857', 3),
('Honorários de Sucumbência', 'receita', 'Honorários', 'Honorários recebidos por condenação em custas processuais', '#065F46', 4),
('Honorários de Precatórios', 'receita', 'Honorários', 'Honorários recebidos de precatórios', '#064E3B', 5),
('Honorários de Parceiros', 'receita', 'Honorários', 'Receitas de indicações e parcerias com outros profissionais', '#22C55E', 6),
('Reembolso de Despesas', 'receita', 'Outros', 'Reembolsos de despesas com clientes', '#3B82F6', 7),
('Venda de Bens/Equipamentos', 'receita', 'Outros', 'Venda de bens ou equipamentos do escritório', '#6366F1', 8);

-- Categorias de Despesa
INSERT INTO public.fin_categorias (nome, tipo, grupo, descricao, cor, ordem) VALUES
('Pessoal e Folha de Pagamento', 'despesa', 'Pessoal', 'Despesas com folha de pagamento e benefícios', '#EF4444', 1),
('Infraestrutura e Manutenção', 'despesa', 'Operacional', 'Despesas com infraestrutura física', '#F97316', 2),
('Operacional e Tecnologia', 'despesa', 'Operacional', 'Softwares, equipamentos e suporte técnico', '#F59E0B', 3),
('Administrativo e Serviços', 'despesa', 'Administrativo', 'Serviços administrativos e bancários', '#EAB308', 4),
('Marketing e Comercial', 'despesa', 'Comercial', 'Despesas com marketing e publicidade', '#84CC16', 5),
('Tributos e Impostos', 'despesa', 'Tributos', 'Impostos e contribuições', '#EC4899', 6),
('Investimentos e Reformas', 'despesa', 'Investimento', 'Compras de ativos e reformas', '#8B5CF6', 7),
('Gastos com Clientes', 'despesa', 'Clientes', 'Despesas pagas em nome de clientes', '#06B6D4', 8);

-- Subcategorias de Pessoal
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Salários', 'Salários mensais de colaboradores'),
  ('13º Salário', 'Décimo terceiro salário'),
  ('Adiantamentos', 'Adiantamentos de salário'),
  ('Vale Alimentação', 'Vale refeição e alimentação'),
  ('Vale Transporte', 'Vale transporte'),
  ('Benefícios', 'Outros benefícios (seguro saúde, etc)'),
  ('Bonificações', 'Bonificações e comissões'),
  ('Distribuição de Lucros', 'Distribuição de lucros aos sócios'),
  ('Retiradas Antecipadas', 'Retiradas antecipadas de sócios'),
  ('Cursos e Palestras', 'Cursos de educação continuada'),
  ('Anuidade OAB', 'Anuidade da Ordem dos Advogados')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Pessoal e Folha de Pagamento';

-- Subcategorias de Infraestrutura
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Aluguel', 'Aluguel do escritório'),
  ('Condomínio', 'Condomínio do prédio'),
  ('Telefonia Fixa', 'Telefone fixo/VOIP'),
  ('Telefonia Móvel', 'Telefone móvel'),
  ('Internet', 'Conexão de internet'),
  ('Energia Elétrica', 'Energia elétrica'),
  ('Água/Saneamento', 'Água e saneamento'),
  ('Limpeza e Higiene', 'Faxina, limpeza, higiene'),
  ('Manutenção Geral', 'Manutenção de estrutura, ar condicionado, etc'),
  ('Material de Limpeza', 'Materiais de limpeza')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Infraestrutura e Manutenção';

-- Subcategorias de Operacional
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('ADVBOX', 'Assinatura do ADVBOX'),
  ('RD Station', 'Assinatura do RD Station'),
  ('Softwares Diversos', 'Outras assinaturas de software'),
  ('Hospedagem e Domínio', 'Hospedagem de site e domínios'),
  ('Informador Jurídico', 'Assinatura de informador jurídico'),
  ('Hardware', 'Computadores, impressoras, etc'),
  ('Suporte Técnico', 'Suporte técnico e manutenção de TI'),
  ('Material de Escritório', 'Papel, canetas, toner, etc'),
  ('Suprimentos Copa', 'Café, açúcar, leite, etc')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Operacional e Tecnologia';

-- Subcategorias de Administrativo
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Contabilidade', 'Serviços de contabilidade'),
  ('Consultoria', 'Serviços de consultoria geral'),
  ('Despesas Bancárias', 'Tarifas, DOC, TED, boleto'),
  ('Deslocamento', 'Combustível, Uber, táxi, passagem'),
  ('Estacionamento', 'Estacionamento'),
  ('Alimentação', 'Almoço, café, refeições'),
  ('Festas e Confraternizações', 'Eventos internos')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Administrativo e Serviços';

-- Subcategorias de Marketing
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Google Ads', 'Tráfego pago no Google'),
  ('Meta Ads', 'Tráfego pago no Facebook/Instagram'),
  ('LinkedIn Ads', 'Tráfego pago no LinkedIn'),
  ('TikTok Ads', 'Tráfego pago no TikTok'),
  ('Outros Anúncios', 'Outros tipos de publicidade'),
  ('Material Gráfico', 'Impressos, brindes, material promocional'),
  ('Eventos e Feiras', 'Participação em eventos')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Marketing e Comercial';

-- Subcategorias de Tributos
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Simples Nacional', 'Contribuição do Simples Nacional (DAS)'),
  ('INSS', 'INSS de contribuinte individual'),
  ('IPVA', 'Imposto sobre veículos'),
  ('FGTS', 'Fundo de Garantia do Tempo de Serviço'),
  ('Taxas Diversas', 'Outras taxas e contribuições')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Tributos e Impostos';

-- Subcategorias de Investimentos
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Equipamentos', 'Compra de computadores, móveis, etc'),
  ('Reforma e Manutenção', 'Reformas estruturais'),
  ('Aplicações Financeiras', 'Investimentos em aplicações'),
  ('Veículos', 'Compra de veículos')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Investimentos e Reformas';

-- Subcategorias de Gastos com Clientes
INSERT INTO public.fin_subcategorias (categoria_id, nome, descricao)
SELECT id, nome_sub, desc_sub FROM public.fin_categorias, 
(VALUES 
  ('Deslocamento', 'Combustível, passagem, pedágio para cliente'),
  ('Hospedagem', 'Hotel para viagem de cliente'),
  ('Alimentação', 'Refeições em viagem de cliente'),
  ('Cartório', 'Emolumentos cartoriais'),
  ('Custas Processuais', 'Custas judiciais'),
  ('Depósitos Recursais', 'Depósitos em juízo'),
  ('Cópias e Entregas', 'Fotocópias, moto boy'),
  ('Outros', 'Outras despesas com cliente')
) AS subs(nome_sub, desc_sub)
WHERE fin_categorias.nome = 'Gastos com Clientes';

-- Setores Iniciais
INSERT INTO public.fin_setores (nome, descricao) VALUES
('Estratégico/Marketing', 'Marketing, IA e estratégia'),
('Comercial', 'Vendas e atendimento a clientes'),
('Operacional', 'Execução de casos e processos'),
('Administrativo', 'Gestão geral e financeira'),
('Interno', 'Despesas internas do escritório');
