
-- Tabela para metas financeiras
CREATE TABLE IF NOT EXISTS public.fin_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'lucro', 'economia')),
  categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  valor_meta DECIMAL(15,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tipo, categoria_id, mes, ano)
);

-- Tabela para orçamento por categoria
CREATE TABLE IF NOT EXISTS public.fin_orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID NOT NULL REFERENCES public.fin_categorias(id) ON DELETE CASCADE,
  valor_planejado DECIMAL(15,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(categoria_id, mes, ano)
);

-- Tabela para backups automáticos
CREATE TABLE IF NOT EXISTS public.fin_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('automatico', 'manual')),
  arquivo_url TEXT,
  tamanho_bytes BIGINT,
  tabelas_incluidas TEXT[],
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  erro_mensagem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.fin_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_backups ENABLE ROW LEVEL SECURITY;

-- Policies para fin_metas
CREATE POLICY "Usuários autenticados podem ver metas" ON public.fin_metas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar metas" ON public.fin_metas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR is_socio_or_rafael(auth.uid())
  );

-- Policies para fin_orcamentos
CREATE POLICY "Usuários autenticados podem ver orçamentos" ON public.fin_orcamentos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar orçamentos" ON public.fin_orcamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR is_socio_or_rafael(auth.uid())
  );

-- Policies para fin_backups
CREATE POLICY "Usuários autenticados podem ver backups" ON public.fin_backups
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar backups" ON public.fin_backups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR is_socio_or_rafael(auth.uid())
  );

-- Trigger para updated_at
CREATE TRIGGER update_fin_metas_updated_at
  BEFORE UPDATE ON public.fin_metas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fin_orcamentos_updated_at
  BEFORE UPDATE ON public.fin_orcamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
