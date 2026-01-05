import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export type PermissionLevel = 'none' | 'view' | 'edit';

export type PermissionFeature =
  | 'financial'
  | 'users'
  | 'announcements'
  | 'suggestions'
  | 'forum'
  | 'documents'
  | 'onboarding'
  | 'events'
  | 'home_office'
  | 'vacation'
  | 'birthdays'
  | 'copa_cozinha'
  | 'advbox'
  | 'collection'
  | 'admin_requests'
  | 'task_rules'
  | 'recruitment'
  | 'lead_tracking'
  | 'totp'
  | 'teams'
  | 'payroll'
  | 'crm'
  | 'processos'
  | 'publicacoes'
  | 'tarefas_advbox'
  | 'decisoes'
  | 'contratos'
  | 'jurisprudencia'
  | 'assistente_ia'
  | 'agentes_ia'
  | 'mensagens'
  | 'sala_reuniao'
  | 'aniversarios_clientes'
  | 'setor_comercial'
  | 'integracoes'
  | 'historico_pagamentos'
  | 'sobre_escritorio'
  | 'caixinha_desabafo'
  | 'arquivos_teams'
  | 'utm_generator'
  | 'rota_doc'
  | 'parceiros';

export interface AdminPermissions {
  perm_financial: PermissionLevel;
  perm_users: PermissionLevel;
  perm_announcements: PermissionLevel;
  perm_suggestions: PermissionLevel;
  perm_forum: PermissionLevel;
  perm_documents: PermissionLevel;
  perm_onboarding: PermissionLevel;
  perm_events: PermissionLevel;
  perm_home_office: PermissionLevel;
  perm_vacation: PermissionLevel;
  perm_birthdays: PermissionLevel;
  perm_copa_cozinha: PermissionLevel;
  perm_advbox: PermissionLevel;
  perm_collection: PermissionLevel;
  perm_admin_requests: PermissionLevel;
  perm_task_rules: PermissionLevel;
  perm_recruitment: PermissionLevel;
  perm_lead_tracking: PermissionLevel;
  perm_totp: PermissionLevel;
  perm_teams: PermissionLevel;
  perm_payroll: PermissionLevel;
  perm_crm: PermissionLevel;
  perm_processos: PermissionLevel;
  perm_publicacoes: PermissionLevel;
  perm_tarefas_advbox: PermissionLevel;
  perm_decisoes: PermissionLevel;
  perm_contratos: PermissionLevel;
  perm_jurisprudencia: PermissionLevel;
  perm_assistente_ia: PermissionLevel;
  perm_agentes_ia: PermissionLevel;
  perm_mensagens: PermissionLevel;
  perm_sala_reuniao: PermissionLevel;
  perm_aniversarios_clientes: PermissionLevel;
  perm_setor_comercial: PermissionLevel;
  perm_integracoes: PermissionLevel;
  perm_historico_pagamentos: PermissionLevel;
  perm_sobre_escritorio: PermissionLevel;
  perm_caixinha_desabafo: PermissionLevel;
  perm_arquivos_teams: PermissionLevel;
  perm_utm_generator: PermissionLevel;
  perm_rota_doc: PermissionLevel;
  perm_parceiros: PermissionLevel;
}

export const useAdminPermissions = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, profile, loading: roleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [groupPermissions, setGroupPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSocioOrRafael, setIsSocioOrRafael] = useState(false);
  const [userGroup, setUserGroup] = useState<string | null>(null);

  useEffect(() => {
    // Safety timeout - se demorar mais de 10 segundos, forçar loading false
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('useAdminPermissions: Safety timeout triggered');
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [loading]);

  useEffect(() => {
    // Aguardar auth e role carregarem antes de verificar permissões
    if (authLoading || roleLoading) {
      return;
    }
    
    if (!user) {
      setPermissions(null);
      setGroupPermissions(null);
      setLoading(false);
      return;
    }

    const checkPermissions = async () => {
      setLoading(true);

      // Check if user is socio or rafael
      const isSocio = profile?.position === 'socio';
      const isRafael = profile?.email === 'rafael@eggnunes.com.br';
      setIsSocioOrRafael(isSocio || isRafael);

      // Sócios and Rafael have full permissions
      if (isSocio || isRafael) {
        const fullPermissions: AdminPermissions = {
          perm_financial: 'edit',
          perm_users: 'edit',
          perm_announcements: 'edit',
          perm_suggestions: 'edit',
          perm_forum: 'edit',
          perm_documents: 'edit',
          perm_onboarding: 'edit',
          perm_events: 'edit',
          perm_home_office: 'edit',
          perm_vacation: 'edit',
          perm_birthdays: 'edit',
          perm_copa_cozinha: 'edit',
          perm_advbox: 'edit',
          perm_collection: 'edit',
          perm_admin_requests: 'edit',
          perm_task_rules: 'edit',
          perm_recruitment: 'edit',
          perm_lead_tracking: 'edit',
          perm_totp: 'edit',
          perm_teams: 'edit',
          perm_payroll: 'edit',
          perm_crm: 'edit',
          perm_processos: 'edit',
          perm_publicacoes: 'edit',
          perm_tarefas_advbox: 'edit',
          perm_decisoes: 'edit',
          perm_contratos: 'edit',
          perm_jurisprudencia: 'edit',
          perm_assistente_ia: 'edit',
          perm_agentes_ia: 'edit',
          perm_mensagens: 'edit',
          perm_sala_reuniao: 'edit',
          perm_aniversarios_clientes: 'edit',
          perm_setor_comercial: 'edit',
          perm_integracoes: 'edit',
          perm_historico_pagamentos: 'edit',
          perm_sobre_escritorio: 'edit',
          perm_caixinha_desabafo: 'edit',
          perm_arquivos_teams: 'edit',
          perm_utm_generator: 'edit',
          perm_rota_doc: 'edit',
          perm_parceiros: 'edit',
        };
        setPermissions(fullPermissions);
        setGroupPermissions(fullPermissions);
        setUserGroup('socio');
        setLoading(false);
        return;
      }

      // Determine user's group - admin group takes priority if user is admin
      const groupKey = isAdmin ? 'admin' : (profile?.position || 'user');
      setUserGroup(groupKey);

      // Fetch group permissions from position_permission_defaults
      const { data: groupData, error: groupError } = await supabase
        .from('position_permission_defaults')
        .select('*')
        .eq('position', groupKey)
        .maybeSingle();

      if (groupError) {
        console.error('Error fetching group permissions:', groupError);
      }

      let basePermissions: AdminPermissions | null = null;

      if (groupData) {
        basePermissions = {
          perm_financial: (groupData.perm_financial as PermissionLevel) || 'none',
          perm_users: (groupData.perm_users as PermissionLevel) || 'none',
          perm_announcements: (groupData.perm_announcements as PermissionLevel) || 'view',
          perm_suggestions: (groupData.perm_suggestions as PermissionLevel) || 'edit',
          perm_forum: (groupData.perm_forum as PermissionLevel) || 'edit',
          perm_documents: (groupData.perm_documents as PermissionLevel) || 'view',
          perm_onboarding: (groupData.perm_onboarding as PermissionLevel) || 'view',
          perm_events: (groupData.perm_events as PermissionLevel) || 'view',
          perm_home_office: (groupData.perm_home_office as PermissionLevel) || 'view',
          perm_vacation: (groupData.perm_vacation as PermissionLevel) || 'view',
          perm_birthdays: (groupData.perm_birthdays as PermissionLevel) || 'view',
          perm_copa_cozinha: (groupData.perm_copa_cozinha as PermissionLevel) || 'edit',
          perm_advbox: (groupData.perm_advbox as PermissionLevel) || 'none',
          perm_collection: (groupData.perm_collection as PermissionLevel) || 'none',
          perm_admin_requests: (groupData.perm_admin_requests as PermissionLevel) || 'view',
          perm_task_rules: (groupData.perm_task_rules as PermissionLevel) || 'none',
          perm_recruitment: (groupData.perm_recruitment as PermissionLevel) || 'none',
          perm_lead_tracking: (groupData.perm_lead_tracking as PermissionLevel) || 'none',
          perm_totp: (groupData.perm_totp as PermissionLevel) || 'none',
          perm_teams: (groupData.perm_teams as PermissionLevel) || 'view',
          perm_payroll: (groupData.perm_payroll as PermissionLevel) || 'none',
          perm_crm: (groupData.perm_crm as PermissionLevel) || 'none',
          perm_processos: (groupData.perm_processos as PermissionLevel) || 'none',
          perm_publicacoes: (groupData.perm_publicacoes as PermissionLevel) || 'none',
          perm_tarefas_advbox: (groupData.perm_tarefas_advbox as PermissionLevel) || 'none',
          perm_decisoes: (groupData.perm_decisoes as PermissionLevel) || 'none',
          perm_contratos: (groupData.perm_contratos as PermissionLevel) || 'none',
          perm_jurisprudencia: (groupData.perm_jurisprudencia as PermissionLevel) || 'view',
          perm_assistente_ia: (groupData.perm_assistente_ia as PermissionLevel) || 'view',
          perm_agentes_ia: (groupData.perm_agentes_ia as PermissionLevel) || 'view',
          perm_mensagens: (groupData.perm_mensagens as PermissionLevel) || 'edit',
          perm_sala_reuniao: (groupData.perm_sala_reuniao as PermissionLevel) || 'edit',
          perm_aniversarios_clientes: (groupData.perm_aniversarios_clientes as PermissionLevel) || 'view',
          perm_setor_comercial: (groupData.perm_setor_comercial as PermissionLevel) || 'none',
          perm_integracoes: (groupData.perm_integracoes as PermissionLevel) || 'none',
          perm_historico_pagamentos: (groupData.perm_historico_pagamentos as PermissionLevel) || 'view',
          perm_sobre_escritorio: (groupData.perm_sobre_escritorio as PermissionLevel) || 'view',
          perm_caixinha_desabafo: (groupData.perm_caixinha_desabafo as PermissionLevel) || 'edit',
          perm_arquivos_teams: (groupData.perm_arquivos_teams as PermissionLevel) || 'view',
          perm_utm_generator: (groupData.perm_utm_generator as PermissionLevel) || 'none',
          perm_rota_doc: (groupData.perm_rota_doc as PermissionLevel) || 'view',
          perm_parceiros: (groupData.perm_parceiros as PermissionLevel) || 'view',
        };
        setGroupPermissions(basePermissions);
      } else {
        // Default fallback permissions for regular users
        basePermissions = {
          perm_financial: 'none',
          perm_users: 'none',
          perm_announcements: 'view',
          perm_suggestions: 'edit',
          perm_forum: 'edit',
          perm_documents: 'view',
          perm_onboarding: 'view',
          perm_events: 'view',
          perm_home_office: 'view',
          perm_vacation: 'view',
          perm_birthdays: 'view',
          perm_copa_cozinha: 'edit',
          perm_advbox: 'none',
          perm_collection: 'none',
          perm_admin_requests: 'view',
          perm_task_rules: 'none',
          perm_recruitment: 'none',
          perm_lead_tracking: 'none',
          perm_totp: 'none',
          perm_teams: 'view',
          perm_payroll: 'none',
          perm_crm: 'none',
          perm_processos: 'none',
          perm_publicacoes: 'none',
          perm_tarefas_advbox: 'none',
          perm_decisoes: 'none',
          perm_contratos: 'none',
          perm_jurisprudencia: 'view',
          perm_assistente_ia: 'view',
          perm_agentes_ia: 'view',
          perm_mensagens: 'edit',
          perm_sala_reuniao: 'edit',
          perm_aniversarios_clientes: 'view',
          perm_setor_comercial: 'none',
          perm_integracoes: 'none',
          perm_historico_pagamentos: 'view',
          perm_sobre_escritorio: 'view',
          perm_caixinha_desabafo: 'edit',
          perm_arquivos_teams: 'view',
          perm_utm_generator: 'none',
          perm_rota_doc: 'view',
          perm_parceiros: 'view',
        };
        setGroupPermissions(basePermissions);
      }

      // Fetch individual permission overrides from admin_permissions
      const { data: individualData, error: individualError } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('admin_user_id', user.id)
        .maybeSingle();

      if (individualError) {
        console.error('Error fetching individual permissions:', individualError);
      }

      // Merge: individual overrides take precedence over group defaults
      if (individualData) {
        const mergedPermissions: AdminPermissions = {
          perm_financial: (individualData.perm_financial as PermissionLevel) || basePermissions.perm_financial,
          perm_users: (individualData.perm_users as PermissionLevel) || basePermissions.perm_users,
          perm_announcements: (individualData.perm_announcements as PermissionLevel) || basePermissions.perm_announcements,
          perm_suggestions: (individualData.perm_suggestions as PermissionLevel) || basePermissions.perm_suggestions,
          perm_forum: (individualData.perm_forum as PermissionLevel) || basePermissions.perm_forum,
          perm_documents: (individualData.perm_documents as PermissionLevel) || basePermissions.perm_documents,
          perm_onboarding: (individualData.perm_onboarding as PermissionLevel) || basePermissions.perm_onboarding,
          perm_events: (individualData.perm_events as PermissionLevel) || basePermissions.perm_events,
          perm_home_office: (individualData.perm_home_office as PermissionLevel) || basePermissions.perm_home_office,
          perm_vacation: (individualData.perm_vacation as PermissionLevel) || basePermissions.perm_vacation,
          perm_birthdays: (individualData.perm_birthdays as PermissionLevel) || basePermissions.perm_birthdays,
          perm_copa_cozinha: (individualData.perm_copa_cozinha as PermissionLevel) || basePermissions.perm_copa_cozinha,
          perm_advbox: (individualData.perm_advbox as PermissionLevel) || basePermissions.perm_advbox,
          perm_collection: (individualData.perm_collection as PermissionLevel) || basePermissions.perm_collection,
          perm_admin_requests: (individualData.perm_admin_requests as PermissionLevel) || basePermissions.perm_admin_requests,
          perm_task_rules: (individualData.perm_task_rules as PermissionLevel) || basePermissions.perm_task_rules,
          perm_recruitment: (individualData.perm_recruitment as PermissionLevel) || basePermissions.perm_recruitment,
          perm_lead_tracking: (individualData.perm_lead_tracking as PermissionLevel) || basePermissions.perm_lead_tracking,
          perm_totp: (individualData.perm_totp as PermissionLevel) || basePermissions.perm_totp,
          perm_teams: (individualData.perm_teams as PermissionLevel) || basePermissions.perm_teams,
          perm_payroll: (individualData.perm_payroll as PermissionLevel) || basePermissions.perm_payroll,
          perm_crm: (individualData.perm_crm as PermissionLevel) || basePermissions.perm_crm,
          perm_processos: (individualData.perm_processos as PermissionLevel) || basePermissions.perm_processos,
          perm_publicacoes: (individualData.perm_publicacoes as PermissionLevel) || basePermissions.perm_publicacoes,
          perm_tarefas_advbox: (individualData.perm_tarefas_advbox as PermissionLevel) || basePermissions.perm_tarefas_advbox,
          perm_decisoes: (individualData.perm_decisoes as PermissionLevel) || basePermissions.perm_decisoes,
          perm_contratos: (individualData.perm_contratos as PermissionLevel) || basePermissions.perm_contratos,
          perm_jurisprudencia: (individualData.perm_jurisprudencia as PermissionLevel) || basePermissions.perm_jurisprudencia,
          perm_assistente_ia: (individualData.perm_assistente_ia as PermissionLevel) || basePermissions.perm_assistente_ia,
          perm_agentes_ia: (individualData.perm_agentes_ia as PermissionLevel) || basePermissions.perm_agentes_ia,
          perm_mensagens: (individualData.perm_mensagens as PermissionLevel) || basePermissions.perm_mensagens,
          perm_sala_reuniao: (individualData.perm_sala_reuniao as PermissionLevel) || basePermissions.perm_sala_reuniao,
          perm_aniversarios_clientes: (individualData.perm_aniversarios_clientes as PermissionLevel) || basePermissions.perm_aniversarios_clientes,
          perm_setor_comercial: (individualData.perm_setor_comercial as PermissionLevel) || basePermissions.perm_setor_comercial,
          perm_integracoes: (individualData.perm_integracoes as PermissionLevel) || basePermissions.perm_integracoes,
          perm_historico_pagamentos: (individualData.perm_historico_pagamentos as PermissionLevel) || basePermissions.perm_historico_pagamentos,
          perm_sobre_escritorio: (individualData.perm_sobre_escritorio as PermissionLevel) || basePermissions.perm_sobre_escritorio,
          perm_caixinha_desabafo: (individualData.perm_caixinha_desabafo as PermissionLevel) || basePermissions.perm_caixinha_desabafo,
          perm_arquivos_teams: (individualData.perm_arquivos_teams as PermissionLevel) || basePermissions.perm_arquivos_teams,
          perm_utm_generator: (individualData.perm_utm_generator as PermissionLevel) || basePermissions.perm_utm_generator,
          perm_rota_doc: (individualData.perm_rota_doc as PermissionLevel) || basePermissions.perm_rota_doc,
          perm_parceiros: (individualData.perm_parceiros as PermissionLevel) || basePermissions.perm_parceiros,
        };
        setPermissions(mergedPermissions);
      } else {
        setPermissions(basePermissions);
      }

      setLoading(false);
    };

    checkPermissions();
  }, [user, isAdmin, profile, authLoading, roleLoading]);

  const hasPermission = (feature: PermissionFeature, level: PermissionLevel = 'view'): boolean => {
    if (!permissions) return false;
    
    const permKey = `perm_${feature}` as keyof AdminPermissions;
    const userLevel = permissions[permKey];
    
    if (level === 'view') {
      return userLevel === 'view' || userLevel === 'edit';
    }
    return userLevel === 'edit';
  };

  const canView = (feature: PermissionFeature): boolean => hasPermission(feature, 'view');
  const canEdit = (feature: PermissionFeature): boolean => hasPermission(feature, 'edit');

  return {
    permissions,
    groupPermissions,
    loading,
    isSocioOrRafael,
    userGroup,
    hasPermission,
    canView,
    canEdit,
  };
};
