-- Add UPDATE policy for users with edit permission on crm_contacts
CREATE POLICY "Usuários com permissão edit podem atualizar contatos"
ON public.crm_contacts
FOR UPDATE
USING (get_admin_permission(auth.uid(), 'lead_tracking'::text) = 'edit'::text);

-- Add UPDATE policy for users with edit permission on crm_activities  
CREATE POLICY "Usuários com permissão edit podem atualizar atividades"
ON public.crm_activities
FOR UPDATE
USING (get_admin_permission(auth.uid(), 'lead_tracking'::text) = 'edit'::text);