
-- ============================================================
-- Fix 1: Enable RLS on sheets_advbox_sync table
-- ============================================================
ALTER TABLE public.sheets_advbox_sync ENABLE ROW LEVEL SECURITY;

-- Allow approved users to read sync data
CREATE POLICY "Approved users can view sheets sync"
  ON public.sheets_advbox_sync
  FOR SELECT
  USING (is_approved(auth.uid()));

-- Only admins/service role can insert/update/delete
CREATE POLICY "Admins can manage sheets sync"
  ON public.sheets_advbox_sync
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- Fix 2: Tighten overly permissive RLS policies
-- Replace USING(true) / WITH CHECK(true) on non-SELECT ops
-- with is_approved(auth.uid()) where appropriate
-- ============================================================

-- fin_alertas
DROP POLICY IF EXISTS "Authenticated users can insert alertas" ON public.fin_alertas;
DROP POLICY IF EXISTS "Authenticated users can update alertas" ON public.fin_alertas;
DROP POLICY IF EXISTS "Authenticated users can delete alertas" ON public.fin_alertas;

CREATE POLICY "Approved users can insert alertas"
  ON public.fin_alertas FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update alertas"
  ON public.fin_alertas FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete alertas"
  ON public.fin_alertas FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_anexos
DROP POLICY IF EXISTS "Authenticated users can insert anexos" ON public.fin_anexos;
DROP POLICY IF EXISTS "Authenticated users can update anexos" ON public.fin_anexos;
DROP POLICY IF EXISTS "Authenticated users can delete anexos" ON public.fin_anexos;

CREATE POLICY "Approved users can insert anexos"
  ON public.fin_anexos FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update anexos"
  ON public.fin_anexos FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete anexos"
  ON public.fin_anexos FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_categorias
DROP POLICY IF EXISTS "Users can insert categories" ON public.fin_categorias;
DROP POLICY IF EXISTS "Users can update categories" ON public.fin_categorias;
DROP POLICY IF EXISTS "Users can delete categories" ON public.fin_categorias;

CREATE POLICY "Approved users can insert categories"
  ON public.fin_categorias FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update categories"
  ON public.fin_categorias FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete categories"
  ON public.fin_categorias FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_centros_custo
DROP POLICY IF EXISTS "Authenticated users can insert centros_custo" ON public.fin_centros_custo;
DROP POLICY IF EXISTS "Authenticated users can update centros_custo" ON public.fin_centros_custo;
DROP POLICY IF EXISTS "Authenticated users can delete centros_custo" ON public.fin_centros_custo;

CREATE POLICY "Approved users can insert centros_custo"
  ON public.fin_centros_custo FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update centros_custo"
  ON public.fin_centros_custo FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete centros_custo"
  ON public.fin_centros_custo FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_clientes
DROP POLICY IF EXISTS "Users can insert clients" ON public.fin_clientes;
DROP POLICY IF EXISTS "Users can update clients" ON public.fin_clientes;
DROP POLICY IF EXISTS "Users can delete clients" ON public.fin_clientes;

CREATE POLICY "Approved users can insert clients"
  ON public.fin_clientes FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update clients"
  ON public.fin_clientes FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete clients"
  ON public.fin_clientes FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_conciliacao_itens
DROP POLICY IF EXISTS "Authenticated users can insert conciliacao_itens" ON public.fin_conciliacao_itens;
DROP POLICY IF EXISTS "Authenticated users can update conciliacao_itens" ON public.fin_conciliacao_itens;
DROP POLICY IF EXISTS "Authenticated users can delete conciliacao_itens" ON public.fin_conciliacao_itens;

CREATE POLICY "Approved users can insert conciliacao_itens"
  ON public.fin_conciliacao_itens FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update conciliacao_itens"
  ON public.fin_conciliacao_itens FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete conciliacao_itens"
  ON public.fin_conciliacao_itens FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_conciliacoes
DROP POLICY IF EXISTS "Authenticated users can insert conciliacoes" ON public.fin_conciliacoes;
DROP POLICY IF EXISTS "Authenticated users can update conciliacoes" ON public.fin_conciliacoes;
DROP POLICY IF EXISTS "Authenticated users can delete conciliacoes" ON public.fin_conciliacoes;

CREATE POLICY "Approved users can insert conciliacoes"
  ON public.fin_conciliacoes FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update conciliacoes"
  ON public.fin_conciliacoes FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete conciliacoes"
  ON public.fin_conciliacoes FOR DELETE
  USING (is_approved(auth.uid()));

-- fin_configuracoes
DROP POLICY IF EXISTS "Users can insert config" ON public.fin_configuracoes;
DROP POLICY IF EXISTS "Users can update config" ON public.fin_configuracoes;

CREATE POLICY "Approved users can insert config"
  ON public.fin_configuracoes FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update config"
  ON public.fin_configuracoes FOR UPDATE
  USING (is_approved(auth.uid()));

-- fin_contas
DROP POLICY IF EXISTS "Users can insert accounts" ON public.fin_contas;
DROP POLICY IF EXISTS "Users can update accounts" ON public.fin_contas;
DROP POLICY IF EXISTS "Users can delete accounts" ON public.fin_contas;

CREATE POLICY "Approved users can insert accounts"
  ON public.fin_contas FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users can update accounts"
  ON public.fin_contas FOR UPDATE
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can delete accounts"
  ON public.fin_contas FOR DELETE
  USING (is_approved(auth.uid()));

-- audit_log INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;
CREATE POLICY "Approved users can insert audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- captured_leads - public form submissions: keep WITH CHECK(true) for INSERT 
-- as this is a public-facing lead capture form (intentional)
-- No change needed

-- crm_deal_history INSERT 
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.crm_deal_history;
CREATE POLICY "Approved users can insert crm deal history"
  ON public.crm_deal_history FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- crm_notifications INSERT
DROP POLICY IF EXISTS "Sistema pode criar notificações" ON public.crm_notifications;
CREATE POLICY "Approved users can insert crm notifications"
  ON public.crm_notifications FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- crm_sync_log INSERT
DROP POLICY IF EXISTS "Sistema pode inserir sync log" ON public.crm_sync_log;
CREATE POLICY "Approved users can insert crm sync log"
  ON public.crm_sync_log FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- asaas tables - service role policies (USING(true)) - these are fine as service role bypasses RLS
-- Keep them as they are - service role manages these tables from edge functions
