-- Adicionar política para usuários com permissão de edição no CRM
CREATE POLICY "Usuários com permissão edit podem atualizar deals"
ON public.crm_deals
FOR UPDATE
USING (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

-- Também para inserir
CREATE POLICY "Usuários com permissão edit podem inserir deals"
ON public.crm_deals
FOR INSERT
WITH CHECK (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

-- Também para deletar
CREATE POLICY "Usuários com permissão edit podem deletar deals"
ON public.crm_deals
FOR DELETE
USING (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

-- Também para crm_deal_history
CREATE POLICY "Usuários autenticados podem inserir histórico"
ON public.crm_deal_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);