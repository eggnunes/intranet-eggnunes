
-- Adicionar coluna salario na tabela profiles se não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salario DECIMAL(12,2);

-- Criar tabela para histórico de salário
CREATE TABLE IF NOT EXISTS public.rh_historico_salario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  salario_anterior DECIMAL(12,2),
  salario_novo DECIMAL(12,2),
  data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.rh_historico_salario ENABLE ROW LEVEL SECURITY;

-- Políticas para histórico de salário
CREATE POLICY "Colaborador pode ver próprio histórico de salário"
  ON public.rh_historico_salario FOR SELECT
  USING (auth.uid() = colaborador_id);

CREATE POLICY "Admins podem ver todos históricos de salário"
  ON public.rh_historico_salario FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND position = 'socio'
    )
  );

CREATE POLICY "Admins podem gerenciar históricos de salário"
  ON public.rh_historico_salario FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'rafael@eggnunes.com.br'
    )
  );

-- Trigger para registrar automaticamente mudanças de salário
CREATE OR REPLACE FUNCTION public.track_salario_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o salario mudou
  IF OLD.salario IS DISTINCT FROM NEW.salario THEN
    INSERT INTO public.rh_historico_salario (colaborador_id, salario_anterior, salario_novo, data_alteracao, observacao)
    VALUES (
      NEW.id,
      OLD.salario,
      NEW.salario,
      now(),
      'Alteração automática de salário'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger na tabela profiles para salário
DROP TRIGGER IF EXISTS on_salario_change ON public.profiles;
CREATE TRIGGER on_salario_change
  AFTER UPDATE OF salario ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.track_salario_changes();
