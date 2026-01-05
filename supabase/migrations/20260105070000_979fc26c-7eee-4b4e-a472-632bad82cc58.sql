-- Adicionar campos de contato ao perfil (telefone, CPF, endereço)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN DEFAULT false;

-- Adicionar novas permissões mais granulares às tabelas de permissões
-- Permissões para CRM
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_crm TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_crm TEXT DEFAULT 'none';

-- Permissões para Processos/Dashboard
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_processos TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_processos TEXT DEFAULT 'none';

-- Permissões para Publicações
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_publicacoes TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_publicacoes TEXT DEFAULT 'none';

-- Permissões para Tarefas Advbox
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_tarefas_advbox TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_tarefas_advbox TEXT DEFAULT 'none';

-- Permissões para Decisões Favoráveis
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_decisoes TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_decisoes TEXT DEFAULT 'none';

-- Permissões para Contratos (gerador)
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_contratos TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_contratos TEXT DEFAULT 'none';

-- Permissões para Pesquisa de Jurisprudência
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_jurisprudencia TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_jurisprudencia TEXT DEFAULT 'none';

-- Permissões para Assistente IA
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_assistente_ia TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_assistente_ia TEXT DEFAULT 'none';

-- Permissões para Agentes IA
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_agentes_ia TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_agentes_ia TEXT DEFAULT 'none';

-- Permissões para Mensagens/Chat interno
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_mensagens TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_mensagens TEXT DEFAULT 'none';

-- Permissões para Sala de Reunião
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_sala_reuniao TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_sala_reuniao TEXT DEFAULT 'none';

-- Permissões para Aniversários de Clientes
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_aniversarios_clientes TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_aniversarios_clientes TEXT DEFAULT 'none';

-- Permissões para Setor Comercial
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_setor_comercial TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_setor_comercial TEXT DEFAULT 'none';

-- Permissões para Integrações
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_integracoes TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_integracoes TEXT DEFAULT 'none';

-- Permissões para Histórico de Pagamentos (visualizar próprio histórico)
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_historico_pagamentos TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_historico_pagamentos TEXT DEFAULT 'none';

-- Permissões para Sobre o Escritório
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_sobre_escritorio TEXT DEFAULT 'view';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_sobre_escritorio TEXT DEFAULT 'view';

-- Permissões para Caixinha de Desabafo
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_caixinha_desabafo TEXT DEFAULT 'edit';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_caixinha_desabafo TEXT DEFAULT 'edit';

-- Permissões para Arquivos Teams
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_arquivos_teams TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_arquivos_teams TEXT DEFAULT 'none';

-- Permissões para UTM Generator
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_utm_generator TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_utm_generator TEXT DEFAULT 'none';

-- Permissões para Documentos Úteis (separado de documents para mais granularidade)
ALTER TABLE public.admin_permissions ADD COLUMN IF NOT EXISTS perm_rota_doc TEXT DEFAULT 'none';
ALTER TABLE public.position_permission_defaults ADD COLUMN IF NOT EXISTS perm_rota_doc TEXT DEFAULT 'none';

-- Criar tabela de notificações do sistema para avisar sobre perfil incompleto
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para notificações do sistema
CREATE POLICY "Users can view their own notifications" 
ON public.system_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.system_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins podem criar notificações para qualquer usuário
CREATE POLICY "Admins can insert notifications" 
ON public.system_notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR auth.uid() = user_id
);

-- Atualizar permissões padrão para grupos existentes
UPDATE public.position_permission_defaults SET
  perm_crm = CASE WHEN position IN ('admin', 'socio') THEN 'edit' WHEN position = 'comercial' THEN 'edit' ELSE 'none' END,
  perm_processos = CASE WHEN position IN ('admin', 'socio', 'advogado') THEN 'edit' WHEN position = 'estagiario' THEN 'view' ELSE 'none' END,
  perm_publicacoes = CASE WHEN position IN ('admin', 'socio', 'advogado') THEN 'edit' WHEN position = 'estagiario' THEN 'view' ELSE 'none' END,
  perm_tarefas_advbox = CASE WHEN position IN ('admin', 'socio', 'advogado') THEN 'edit' WHEN position = 'estagiario' THEN 'view' ELSE 'none' END,
  perm_decisoes = CASE WHEN position IN ('admin', 'socio', 'advogado') THEN 'edit' WHEN position = 'estagiario' THEN 'view' ELSE 'none' END,
  perm_contratos = CASE WHEN position IN ('admin', 'socio', 'advogado') THEN 'edit' ELSE 'none' END,
  perm_jurisprudencia = CASE WHEN position IN ('admin', 'socio', 'advogado', 'estagiario') THEN 'edit' ELSE 'view' END,
  perm_assistente_ia = CASE WHEN position IN ('admin', 'socio', 'advogado', 'estagiario') THEN 'edit' ELSE 'view' END,
  perm_agentes_ia = CASE WHEN position IN ('admin', 'socio', 'advogado', 'estagiario') THEN 'edit' ELSE 'view' END,
  perm_mensagens = 'edit',
  perm_sala_reuniao = 'edit',
  perm_aniversarios_clientes = CASE WHEN position IN ('admin', 'socio') THEN 'edit' ELSE 'view' END,
  perm_setor_comercial = CASE WHEN position IN ('admin', 'socio', 'comercial') THEN 'edit' ELSE 'none' END,
  perm_integracoes = CASE WHEN position IN ('admin', 'socio') THEN 'edit' ELSE 'none' END,
  perm_historico_pagamentos = 'view',
  perm_sobre_escritorio = 'view',
  perm_caixinha_desabafo = 'edit',
  perm_arquivos_teams = CASE WHEN position IN ('admin', 'socio') THEN 'edit' ELSE 'view' END,
  perm_utm_generator = CASE WHEN position IN ('admin', 'socio', 'comercial') THEN 'edit' ELSE 'none' END,
  perm_rota_doc = CASE WHEN position IN ('admin', 'socio', 'advogado', 'estagiario') THEN 'edit' ELSE 'view' END;

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;