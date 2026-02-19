
-- Fix remaining overly permissive policies (non-service-role)
-- The "Service role can manage *" policies (advbox_sync_status, asaas_*) 
-- are intentional for edge functions using service_role key - keep them

-- fin_importacao_itens
DROP POLICY IF EXISTS "Authenticated users can insert import items" ON public.fin_importacao_itens;
DROP POLICY IF EXISTS "Authenticated users can update import items" ON public.fin_importacao_itens;
DROP POLICY IF EXISTS "Authenticated users can delete import items" ON public.fin_importacao_itens;

CREATE POLICY "Approved users can insert import items"
  ON public.fin_importacao_itens FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update import items"
  ON public.fin_importacao_itens FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete import items"
  ON public.fin_importacao_itens FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_importacoes
DROP POLICY IF EXISTS "Authenticated users can insert imports" ON public.fin_importacoes;
DROP POLICY IF EXISTS "Authenticated users can update imports" ON public.fin_importacoes;

CREATE POLICY "Approved users can insert imports"
  ON public.fin_importacoes FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update imports"
  ON public.fin_importacoes FOR UPDATE
  USING (is_approved(auth.uid()));

-- fin_lancamentos
DROP POLICY IF EXISTS "Users can update transactions" ON public.fin_lancamentos;
DROP POLICY IF EXISTS "Users can delete transactions" ON public.fin_lancamentos;

CREATE POLICY "Approved users can update transactions"
  ON public.fin_lancamentos FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete transactions"
  ON public.fin_lancamentos FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_metas
DROP POLICY IF EXISTS "Authenticated users can insert metas" ON public.fin_metas;
DROP POLICY IF EXISTS "Authenticated users can update metas" ON public.fin_metas;
DROP POLICY IF EXISTS "Authenticated users can delete metas" ON public.fin_metas;

CREATE POLICY "Approved users can insert metas"
  ON public.fin_metas FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update metas"
  ON public.fin_metas FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete metas"
  ON public.fin_metas FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_orcamentos
DROP POLICY IF EXISTS "Authenticated users can insert budgets" ON public.fin_orcamentos;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON public.fin_orcamentos;
DROP POLICY IF EXISTS "Authenticated users can delete budgets" ON public.fin_orcamentos;

CREATE POLICY "Approved users can insert budgets"
  ON public.fin_orcamentos FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update budgets"
  ON public.fin_orcamentos FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete budgets"
  ON public.fin_orcamentos FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_recorrencias
DROP POLICY IF EXISTS "Authenticated users can insert recorrencias" ON public.fin_recorrencias;
DROP POLICY IF EXISTS "Authenticated users can update recorrencias" ON public.fin_recorrencias;
DROP POLICY IF EXISTS "Authenticated users can delete recorrencias" ON public.fin_recorrencias;

CREATE POLICY "Approved users can insert recorrencias"
  ON public.fin_recorrencias FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update recorrencias"
  ON public.fin_recorrencias FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete recorrencias"
  ON public.fin_recorrencias FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_setores
DROP POLICY IF EXISTS "Users can insert sectors" ON public.fin_setores;
DROP POLICY IF EXISTS "Users can update sectors" ON public.fin_setores;
DROP POLICY IF EXISTS "Users can delete sectors" ON public.fin_setores;

CREATE POLICY "Approved users can insert sectors"
  ON public.fin_setores FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update sectors"
  ON public.fin_setores FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete sectors"
  ON public.fin_setores FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_subcategorias
DROP POLICY IF EXISTS "Users can insert subcategories" ON public.fin_subcategorias;
DROP POLICY IF EXISTS "Users can update subcategories" ON public.fin_subcategorias;
DROP POLICY IF EXISTS "Users can delete subcategories" ON public.fin_subcategorias;

CREATE POLICY "Approved users can insert subcategories"
  ON public.fin_subcategorias FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update subcategories"
  ON public.fin_subcategorias FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete subcategories"
  ON public.fin_subcategorias FOR DELETE
  USING (is_approved(auth.uid()));

-- rh_cargo_salary_history
DROP POLICY IF EXISTS "Authenticated users can insert salary history" ON public.rh_cargo_salary_history;

CREATE POLICY "Approved users can insert salary history"
  ON public.rh_cargo_salary_history FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- whatsapp_comment_mentions
DROP POLICY IF EXISTS "Authenticated users can insert mentions" ON public.whatsapp_comment_mentions;

CREATE POLICY "Approved users can insert mentions"
  ON public.whatsapp_comment_mentions FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- whatsapp_conversation_assignees
DROP POLICY IF EXISTS "Authenticated users can insert assignees" ON public.whatsapp_conversation_assignees;
DROP POLICY IF EXISTS "Authenticated users can delete assignees" ON public.whatsapp_conversation_assignees;

CREATE POLICY "Approved users can insert assignees"
  ON public.whatsapp_conversation_assignees FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete assignees"
  ON public.whatsapp_conversation_assignees FOR DELETE
  USING (is_approved(auth.uid()));

-- whatsapp_conversation_tags
DROP POLICY IF EXISTS "Authenticated users can insert conversation tags" ON public.whatsapp_conversation_tags;
DROP POLICY IF EXISTS "Authenticated users can delete conversation tags" ON public.whatsapp_conversation_tags;

CREATE POLICY "Approved users can insert conversation tags"
  ON public.whatsapp_conversation_tags FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete conversation tags"
  ON public.whatsapp_conversation_tags FOR DELETE
  USING (is_approved(auth.uid()));

-- whatsapp_tags
DROP POLICY IF EXISTS "Authenticated users can insert tags" ON public.whatsapp_tags;
DROP POLICY IF EXISTS "Authenticated users can update tags" ON public.whatsapp_tags;
DROP POLICY IF EXISTS "Authenticated users can delete tags" ON public.whatsapp_tags;

CREATE POLICY "Approved users can insert tags"
  ON public.whatsapp_tags FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update tags"
  ON public.whatsapp_tags FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete tags"
  ON public.whatsapp_tags FOR DELETE
  USING (is_approved(auth.uid()));

-- Note: captured_leads INSERT with WITH CHECK(true) is INTENTIONAL
-- Public lead capture forms need to accept submissions from unauthenticated users
-- zapi_messages_log, zapi_webhook_events, zapsign_documents: service role policies - INTENTIONAL
