
ALTER TABLE public.viabilidade_clientes
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS tipo_acao TEXT,
  ADD COLUMN IF NOT EXISTS descricao_caso TEXT,
  ADD COLUMN IF NOT EXISTS documentos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parecer_viabilidade TEXT,
  ADD COLUMN IF NOT EXISTS analise_realizada_em TIMESTAMPTZ;
