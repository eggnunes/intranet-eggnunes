
CREATE TABLE public.client_form_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_row_id INTEGER NOT NULL UNIQUE,
  nome_completo TEXT,
  cpf TEXT,
  documento_identidade TEXT,
  como_conheceu TEXT,
  data_nascimento TEXT,
  estado_civil TEXT,
  profissao TEXT,
  telefone TEXT,
  tem_whatsapp TEXT,
  email TEXT,
  cep TEXT,
  cidade TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  estado TEXT,
  nome_pai TEXT,
  nome_mae TEXT,
  opcao_pagamento TEXT,
  quantidade_parcelas TEXT,
  data_vencimento TEXT,
  aposentado TEXT,
  previsao_aposentadoria TEXT,
  possui_emprestimo TEXT,
  doenca_grave TEXT,
  plano_saude TEXT,
  qual_plano_saude TEXT,
  negativa_plano TEXT,
  doenca_negativa TEXT,
  conhece_alguem_situacao TEXT,
  conhece_alguem_mesma_situacao TEXT,
  telefone_alternativo TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_form_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read overrides"
  ON public.client_form_overrides FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Admins can insert overrides"
  ON public.client_form_overrides FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can update overrides"
  ON public.client_form_overrides FOR UPDATE TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));

CREATE POLICY "Admins can delete overrides"
  ON public.client_form_overrides FOR DELETE TO authenticated
  USING (public.is_admin_or_socio(auth.uid()));
