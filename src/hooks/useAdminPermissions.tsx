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
  | 'recruitment';

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
}

export const useAdminPermissions = () => {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [groupPermissions, setGroupPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSocioOrRafael, setIsSocioOrRafael] = useState(false);
  const [userGroup, setUserGroup] = useState<string | null>(null);

  useEffect(() => {
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
          perm_financial: groupData.perm_financial as PermissionLevel,
          perm_users: groupData.perm_users as PermissionLevel,
          perm_announcements: groupData.perm_announcements as PermissionLevel,
          perm_suggestions: groupData.perm_suggestions as PermissionLevel,
          perm_forum: groupData.perm_forum as PermissionLevel,
          perm_documents: groupData.perm_documents as PermissionLevel,
          perm_onboarding: groupData.perm_onboarding as PermissionLevel,
          perm_events: groupData.perm_events as PermissionLevel,
          perm_home_office: groupData.perm_home_office as PermissionLevel,
          perm_vacation: groupData.perm_vacation as PermissionLevel,
          perm_birthdays: groupData.perm_birthdays as PermissionLevel,
          perm_copa_cozinha: groupData.perm_copa_cozinha as PermissionLevel,
          perm_advbox: groupData.perm_advbox as PermissionLevel,
          perm_collection: groupData.perm_collection as PermissionLevel,
          perm_admin_requests: groupData.perm_admin_requests as PermissionLevel,
          perm_task_rules: groupData.perm_task_rules as PermissionLevel,
          perm_recruitment: groupData.perm_recruitment as PermissionLevel,
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
        };
        setPermissions(mergedPermissions);
      } else {
        setPermissions(basePermissions);
      }

      setLoading(false);
    };

    checkPermissions();
  }, [user, isAdmin, profile]);

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
