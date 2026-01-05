-- Tabela para histórico de promoções
CREATE TABLE public.rh_promocoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo_anterior_id UUID REFERENCES public.rh_cargos(id),
  cargo_anterior_nome TEXT NOT NULL,
  cargo_novo_id UUID REFERENCES public.rh_cargos(id),
  cargo_novo_nome TEXT NOT NULL,
  data_promocao DATE NOT NULL,
  observacoes TEXT,
  registrado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.rh_promocoes ENABLE ROW LEVEL SECURITY;

-- Políticas - Colaborador pode ver suas próprias promoções
CREATE POLICY "Colaboradores podem ver suas próprias promoções"
ON public.rh_promocoes
FOR SELECT
USING (
  auth.uid() = colaborador_id OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (position = 'socio' OR email = 'rafael@eggnunes.com.br')
  )
);

-- Apenas Rafael pode inserir/atualizar/deletar promoções
CREATE POLICY "Apenas Rafael pode gerenciar promoções"
ON public.rh_promocoes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND email = 'rafael@eggnunes.com.br'
  )
);

-- Inserir promoção da Jordânia (Júnior II -> Pleno I)
INSERT INTO public.rh_promocoes (
  colaborador_id,
  cargo_anterior_id,
  cargo_anterior_nome,
  cargo_novo_id,
  cargo_novo_nome,
  data_promocao,
  observacoes,
  registrado_por
)
SELECT 
  '1b5787c3-c10d-4e0b-8699-83d0a2215dea' as colaborador_id,
  'd3245efe-2dc3-47e0-a309-c235248250e9' as cargo_anterior_id,
  'Júnior II' as cargo_anterior_nome,
  'db71161a-4428-4110-bb58-c08028f477a9' as cargo_novo_id,
  'Pleno I' as cargo_novo_nome,
  '2026-01-01' as data_promocao,
  'Promoção por mérito e desempenho' as observacoes,
  'd322e9aa-84eb-4b42-960c-7732d8a60bce' as registrado_por;

-- Atualizar cargo da Jordânia para Pleno I
UPDATE public.profiles 
SET cargo_id = 'db71161a-4428-4110-bb58-c08028f477a9'
WHERE id = '1b5787c3-c10d-4e0b-8699-83d0a2215dea';

-- Criar índice para performance
CREATE INDEX idx_rh_promocoes_colaborador ON public.rh_promocoes(colaborador_id);
CREATE INDEX idx_rh_promocoes_data ON public.rh_promocoes(data_promocao DESC);