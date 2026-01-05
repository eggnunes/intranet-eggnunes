
-- Tabela de orçamentos mensais
CREATE TABLE IF NOT EXISTS public.fin_orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID REFERENCES public.fin_categorias(id),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  valor_planejado NUMERIC(15,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(categoria_id, mes, ano)
);

-- Tabela de importações bancárias
CREATE TABLE IF NOT EXISTS public.fin_importacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL, -- 'ofx', 'csv'
  conta_id UUID REFERENCES public.fin_contas(id),
  total_registros INTEGER DEFAULT 0,
  registros_importados INTEGER DEFAULT 0,
  registros_duplicados INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processando', -- 'processando', 'concluido', 'erro'
  erro_mensagem TEXT,
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens importados (para revisão antes de confirmar)
CREATE TABLE IF NOT EXISTS public.fin_importacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  importacao_id UUID REFERENCES public.fin_importacoes(id) ON DELETE CASCADE,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  tipo TEXT NOT NULL, -- 'credito', 'debito'
  identificador_banco TEXT, -- ID único do banco para evitar duplicatas
  status TEXT DEFAULT 'pendente', -- 'pendente', 'importado', 'ignorado', 'duplicado'
  lancamento_id UUID REFERENCES public.fin_lancamentos(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar campo de parcelas ao lançamento
ALTER TABLE public.fin_lancamentos 
ADD COLUMN IF NOT EXISTS parcela_atual INTEGER,
ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
ADD COLUMN IF NOT EXISTS lancamento_pai_id UUID REFERENCES public.fin_lancamentos(id);

-- Enable RLS
ALTER TABLE public.fin_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_importacao_itens ENABLE ROW LEVEL SECURITY;

-- Políticas para orçamentos
CREATE POLICY "Authenticated users can view budgets" ON public.fin_orcamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert budgets" ON public.fin_orcamentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update budgets" ON public.fin_orcamentos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete budgets" ON public.fin_orcamentos
  FOR DELETE TO authenticated USING (true);

-- Políticas para importações
CREATE POLICY "Authenticated users can view imports" ON public.fin_importacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert imports" ON public.fin_importacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update imports" ON public.fin_importacoes
  FOR UPDATE TO authenticated USING (true);

-- Políticas para itens de importação
CREATE POLICY "Authenticated users can view import items" ON public.fin_importacao_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert import items" ON public.fin_importacao_itens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update import items" ON public.fin_importacao_itens
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete import items" ON public.fin_importacao_itens
  FOR DELETE TO authenticated USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_orcamentos_periodo ON public.fin_orcamentos(ano, mes);
CREATE INDEX IF NOT EXISTS idx_fin_importacoes_conta ON public.fin_importacoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_fin_importacao_itens_importacao ON public.fin_importacao_itens(importacao_id);
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_parcela ON public.fin_lancamentos(lancamento_pai_id);
