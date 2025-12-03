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
  | 'task_rules';

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
}

export const useAdminPermissions = () => {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSocioOrRafael, setIsSocioOrRafael] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermissions(null);
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
        };
        setPermissions(fullPermissions);
        setLoading(false);
        return;
      }

      // If not admin, no permissions
      if (!isAdmin) {
        setPermissions(null);
        setLoading(false);
        return;
      }

      // Fetch admin permissions from database
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('admin_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching admin permissions:', error);
        setPermissions(null);
      } else if (data) {
        setPermissions({
          perm_financial: data.perm_financial as PermissionLevel,
          perm_users: data.perm_users as PermissionLevel,
          perm_announcements: data.perm_announcements as PermissionLevel,
          perm_suggestions: data.perm_suggestions as PermissionLevel,
          perm_forum: data.perm_forum as PermissionLevel,
          perm_documents: data.perm_documents as PermissionLevel,
          perm_onboarding: data.perm_onboarding as PermissionLevel,
          perm_events: data.perm_events as PermissionLevel,
          perm_home_office: data.perm_home_office as PermissionLevel,
          perm_vacation: data.perm_vacation as PermissionLevel,
          perm_birthdays: data.perm_birthdays as PermissionLevel,
          perm_copa_cozinha: data.perm_copa_cozinha as PermissionLevel,
          perm_advbox: data.perm_advbox as PermissionLevel,
          perm_collection: data.perm_collection as PermissionLevel,
          perm_admin_requests: data.perm_admin_requests as PermissionLevel,
          perm_task_rules: data.perm_task_rules as PermissionLevel,
        });
      } else {
        // No permissions record, default to none
        setPermissions(null);
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
    loading,
    isSocioOrRafael,
    hasPermission,
    canView,
    canEdit,
  };
};
