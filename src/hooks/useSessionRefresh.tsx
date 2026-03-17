import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const isJwtError = (msg: string | undefined | null): boolean => {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return lower.includes('jwt') || lower.includes('token') || lower.includes('expired') || lower.includes('expirad');
};

export const useSessionRefresh = () => {
  const { signOut } = useAuth();

  const ensureValidSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.warn('Session refresh failed, signing out', error?.message);
        toast.error('Sessão expirada. Faça login novamente.');
        await signOut();
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error refreshing session', e);
      toast.error('Sessão expirada. Faça login novamente.');
      await signOut();
      return false;
    }
  }, [signOut]);

  const retryWithRefresh = useCallback(async <T extends { error: { message: string } | null }>(
    operation: () => PromiseLike<T>
  ): Promise<T> => {
    const result = await operation();

    if (result.error && isJwtError(result.error.message)) {
      console.log('JWT error detected, attempting session refresh...');
      const refreshed = await ensureValidSession();
      if (refreshed) {
        return await operation();
      }
    }

    return result;
  }, [ensureValidSession]);

  return { ensureValidSession, retryWithRefresh };
};
