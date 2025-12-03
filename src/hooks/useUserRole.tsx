import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'user' | null;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  avatar_url: string | null;
  position: 'socio' | 'advogado' | 'estagiario' | 'comercial' | 'administrativo' | null;
  birth_date: string | null;
  oab_number: string | null;
  oab_state: string | null;
  join_date: string | null;
}

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchRoleAndProfile = async () => {
      // Buscar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Buscar role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setRole(roleData?.role as UserRole || 'user');
      setLoading(false);
    };

    fetchRoleAndProfile();
  }, [user]);

  return { role, profile, loading, isAdmin: role === 'admin', isApproved: profile?.approval_status === 'approved' };
};
