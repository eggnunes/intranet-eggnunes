-- Permitir que usuarios aprovados possam cadastrar parceiros
CREATE POLICY "Usuarios aprovados podem criar parceiros"
ON public.parceiros FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir que usuarios aprovados criem indicacoes
CREATE POLICY "Usuarios aprovados podem criar indicacoes"
ON public.parceiros_indicacoes FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir que usuarios aprovados criem pagamentos
CREATE POLICY "Usuarios aprovados podem criar pagamentos"
ON public.parceiros_pagamentos FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));

-- Permitir vinculacao de areas
CREATE POLICY "Usuarios aprovados podem vincular areas"
ON public.parceiros_areas FOR INSERT
TO public
WITH CHECK (is_approved(auth.uid()));