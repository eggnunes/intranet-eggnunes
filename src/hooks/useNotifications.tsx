import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
  _source?: 'user_notifications' | 'system_notifications';
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Fetch from user_notifications
      const { data: userNotifs, error: userError } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (userError) throw userError;

      // Fetch from system_notifications (unread only)
      const { data: systemNotifs } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(10);

      // Map user_notifications with source tag
      const mappedUserNotifs: UserNotification[] = (userNotifs || []).map((n: any) => ({
        ...n,
        _source: 'user_notifications' as const,
      }));

      // Map system_notifications with source tag
      const mappedSystemNotifs: UserNotification[] = (systemNotifs || []).map((n: any) => ({
        id: n.id,
        user_id: n.user_id,
        title: n.titulo,
        message: n.mensagem,
        type: n.tipo,
        is_read: n.lida,
        action_url: '/profile',
        metadata: null,
        created_at: n.created_at,
        read_at: n.read_at,
        _source: 'system_notifications' as const,
      }));

      // Merge and sort by created_at
      const allNotifications = [...mappedUserNotifs, ...mappedSystemNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Carregar notificações iniciais
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Configurar realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = { ...(payload.new as UserNotification), _source: 'user_notifications' as const };
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refetch to get accurate state
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setNotifications(prev => {
            const updated = prev.filter(n => n.id !== deletedId);
            setUnreadCount(updated.filter(n => !n.is_read).length);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    // Find which table the notification came from
    const notification = notifications.find(n => n.id === notificationId);
    const source = notification?._source;

    try {
      if (source === 'system_notifications') {
        const { error } = await supabase
          .from('system_notifications')
          .update({ lida: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);

        if (error) throw error;

        // Remove from list since we only show unread system notifications
        setNotifications(prev => {
          const updated = prev.filter(n => n.id !== notificationId);
          setUnreadCount(updated.filter(n => !n.is_read).length);
          return updated;
        });
      } else {
        // Default: user_notifications
        const { error } = await supabase
          .from('user_notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);

        if (error) throw error;

        setNotifications(prev => {
          const updated = prev.map(n =>
            n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          );
          setUnreadCount(updated.filter(n => !n.is_read).length);
          return updated;
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Refetch on error to ensure consistent state
      await fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Mark all user_notifications as read
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Mark all system_notifications as read
      await supabase
        .from('system_notifications')
        .update({ lida: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('lida', false);

      // Refetch to get accurate state (system_notifications disappear when read)
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    const source = notification?._source;

    try {
      if (source === 'system_notifications') {
        // For system_notifications, mark as read (they don't have a delete)
        const { error } = await supabase
          .from('system_notifications')
          .update({ lida: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);

        if (error) throw error;
      } else {
        // Delete from user_notifications
        const { error } = await supabase
          .from('user_notifications')
          .delete()
          .eq('id', notificationId);

        if (error) throw error;
      }

      // Immediately remove from local state
      setNotifications(prev => {
        const updated = prev.filter(n => n.id !== notificationId);
        setUnreadCount(updated.filter(n => !n.is_read).length);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Refetch on error to ensure consistent state
      await fetchNotifications();
    }
  };

  const clearAll = async () => {
    if (!user) return;

    try {
      // Delete all user_notifications
      await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', user.id);

      // Mark all system_notifications as read
      await supabase
        .from('system_notifications')
        .update({ lida: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('lida', false);

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications
  };
};
