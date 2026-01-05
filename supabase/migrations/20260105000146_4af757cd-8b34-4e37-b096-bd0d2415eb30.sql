-- =====================================================
-- NOVAS TABELAS PARA FUNCIONALIDADES ADICIONAIS
-- =====================================================

-- 1. Tabela de Metas Financeiras
CREATE TABLE public.fin_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'economia')),
  categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  valor_meta DECIMAL(15,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  descricao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (tipo, categoria_id, mes, ano)
);

-- 2. Tabela de Centros de Custo
CREATE TABLE public.fin_centros_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(20),
  descricao TEXT,
  responsavel_id UUID,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Anexos de Lançamentos
CREATE TABLE public.fin_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(255) NOT NULL,
  tipo_arquivo VARCHAR(50),
  tamanho INTEGER,
  url_arquivo TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de Lançamentos Recorrentes
CREATE TABLE public.fin_recorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  subcategoria_id UUID REFERENCES public.fin_subcategorias(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.fin_clientes(id) ON DELETE SET NULL,
  setor_id UUID REFERENCES public.fin_setores(id) ON DELETE SET NULL,
  valor DECIMAL(15,2) NOT NULL,
  descricao TEXT NOT NULL,
  dia_vencimento INTEGER CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('mensal', 'quinzenal', 'semanal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  proxima_geracao DATE,
  ativo BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Tabela de Alertas de Vencimento
CREATE TABLE public.fin_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  mensagem TEXT NOT NULL,
  data_alerta DATE NOT NULL,
  lido BOOLEAN DEFAULT false,
  lido_por UUID,
  lido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Tabela de Conciliação Bancária
CREATE TABLE public.fin_conciliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID REFERENCES public.fin_contas(id) ON DELETE CASCADE NOT NULL,
  data_conciliacao DATE NOT NULL,
  saldo_banco DECIMAL(15,2) NOT NULL,
  saldo_sistema DECIMAL(15,2) NOT NULL,
  diferenca DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'divergente')),
  observacoes TEXT,
  conciliado_por UUID,
  conciliado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Itens de Conciliação
CREATE TABLE public.fin_conciliacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conciliacao_id UUID REFERENCES public.fin_conciliacoes(id) ON DELETE CASCADE NOT NULL,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  descricao_extrato VARCHAR(255),
  valor_extrato DECIMAL(15,2),
  data_extrato DATE,
  conciliado BOOLEAN DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar campo de centro de custo e parcelas na tabela de lançamentos
ALTER TABLE public.fin_lancamentos 
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES public.fin_recorrencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parcela_atual INTEGER,
  ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS lancamento_pai_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS produto_rd_station VARCHAR(255);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_fin_metas_tipo_ano ON public.fin_metas(tipo, ano);
CREATE INDEX IF NOT EXISTS idx_fin_anexos_lancamento ON public.fin_anexos(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_recorrencias_proxima ON public.fin_recorrencias(proxima_geracao) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_fin_alertas_data ON public.fin_alertas(data_alerta) WHERE lido = false;
CREATE INDEX IF NOT EXISTS idx_fin_conciliacoes_conta ON public.fin_conciliacoes(conta_id, data_conciliacao);
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_vencimento ON public.fin_lancamentos(data_vencimento) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_centro_custo ON public.fin_lancamentos(centro_custo_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.fin_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_recorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_conciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_conciliacao_itens ENABLE ROW LEVEL SECURITY;

-- Policies para fin_metas
CREATE POLICY "Authenticated users can read metas" ON public.fin_metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert metas" ON public.fin_metas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update metas" ON public.fin_metas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete metas" ON public.fin_metas FOR DELETE TO authenticated USING (true);

-- Policies para fin_centros_custo
CREATE POLICY "Authenticated users can read centros_custo" ON public.fin_centros_custo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert centros_custo" ON public.fin_centros_custo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update centros_custo" ON public.fin_centros_custo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete centros_custo" ON public.fin_centros_custo FOR DELETE TO authenticated USING (true);

-- Policies para fin_anexos
CREATE POLICY "Authenticated users can read anexos" ON public.fin_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert anexos" ON public.fin_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update anexos" ON public.fin_anexos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete anexos" ON public.fin_anexos FOR DELETE TO authenticated USING (true);

-- Policies para fin_recorrencias
CREATE POLICY "Authenticated users can read recorrencias" ON public.fin_recorrencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert recorrencias" ON public.fin_recorrencias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update recorrencias" ON public.fin_recorrencias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete recorrencias" ON public.fin_recorrencias FOR DELETE TO authenticated USING (true);

-- Policies para fin_alertas
CREATE POLICY "Authenticated users can read alertas" ON public.fin_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert alertas" ON public.fin_alertas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update alertas" ON public.fin_alertas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete alertas" ON public.fin_alertas FOR DELETE TO authenticated USING (true);

-- Policies para fin_conciliacoes
CREATE POLICY "Authenticated users can read conciliacoes" ON public.fin_conciliacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert conciliacoes" ON public.fin_conciliacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update conciliacoes" ON public.fin_conciliacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete conciliacoes" ON public.fin_conciliacoes FOR DELETE TO authenticated USING (true);

-- Policies para fin_conciliacao_itens
CREATE POLICY "Authenticated users can read conciliacao_itens" ON public.fin_conciliacao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert conciliacao_itens" ON public.fin_conciliacao_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update conciliacao_itens" ON public.fin_conciliacao_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete conciliacao_itens" ON public.fin_conciliacao_itens FOR DELETE TO authenticated USING (true);

-- =====================================================
-- DADOS INICIAIS - CENTROS DE CUSTO
-- =====================================================
INSERT INTO public.fin_centros_custo (nome, codigo, descricao) VALUES
  ('Administrativo', 'ADM', 'Custos administrativos gerais'),
  ('Operacional Jurídico', 'OPJ', 'Custos operacionais jurídicos'),
  ('Marketing', 'MKT', 'Investimentos em marketing e publicidade'),
  ('Tecnologia', 'TEC', 'Custos com tecnologia e sistemas'),
  ('RH', 'RH', 'Recursos humanos e pessoal');