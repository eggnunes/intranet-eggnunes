import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PresenceState {
  id: string;
  online_at: string;
}

export const usePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const userIds = new Set<string>();
        
        Object.keys(presenceState).forEach((key) => {
          userIds.add(key);
        });
        
        setOnlineUsers(userIds);
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.has(userId),
    [onlineUsers]
  );

  return {
    onlineUsers,
    onlineCount: onlineUsers.size,
    isUserOnline,
    isConnected,
  };
};
