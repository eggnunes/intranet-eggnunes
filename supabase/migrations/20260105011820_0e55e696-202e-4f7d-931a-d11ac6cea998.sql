
-- Item 6: Tabela de anexos já existe (fin_anexos), apenas garantir que está completa
-- Verificar e adicionar campos se necessário

-- Item 7: Sistema de Aprovação de Despesas
CREATE TABLE IF NOT EXISTS public.fin_aprovacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL,
  aprovador_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  valor_limite NUMERIC(15,2),
  justificativa TEXT,
  resposta_aprovador TEXT,
  solicitado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurações de aprovação por valor
CREATE TABLE IF NOT EXISTS public.fin_aprovacao_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  valor_minimo NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_maximo NUMERIC(15,2),
  aprovador_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item 8: Previsões financeiras
CREATE TABLE IF NOT EXISTS public.fin_previsoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'fluxo')),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_previsto NUMERIC(15,2) NOT NULL,
  valor_realizado NUMERIC(15,2),
  confianca NUMERIC(5,2),
  modelo_utilizado TEXT,
  parametros JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar campo de aprovação necessária nos lançamentos
ALTER TABLE public.fin_lancamentos 
ADD COLUMN IF NOT EXISTS requer_aprovacao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'nao_requerido' CHECK (status_aprovacao IN ('nao_requerido', 'pendente', 'aprovado', 'rejeitado'));

-- RLS para aprovações
ALTER TABLE public.fin_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_aprovacao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_previsoes ENABLE ROW LEVEL SECURITY;

-- Políticas para aprovações
CREATE POLICY "Usuários podem ver suas solicitações" ON public.fin_aprovacoes
  FOR SELECT USING (auth.uid() = solicitante_id OR auth.uid() = aprovador_id OR is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários podem criar solicitações" ON public.fin_aprovacoes
  FOR INSERT WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "Aprovadores podem atualizar" ON public.fin_aprovacoes
  FOR UPDATE USING (auth.uid() = aprovador_id OR is_socio_or_rafael(auth.uid()));

-- Políticas para config de aprovação
CREATE POLICY "Admins podem gerenciar config aprovação" ON public.fin_aprovacao_config
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

CREATE POLICY "Usuários podem ver config" ON public.fin_aprovacao_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas para previsões
CREATE POLICY "Usuários autenticados podem ver previsões" ON public.fin_previsoes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar previsões" ON public.fin_previsoes
  FOR ALL USING (is_socio_or_rafael(auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_aprovacoes_lancamento ON public.fin_aprovacoes(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_aprovacoes_status ON public.fin_aprovacoes(status);
CREATE INDEX IF NOT EXISTS idx_fin_previsoes_periodo ON public.fin_previsoes(periodo_inicio, periodo_fim);
