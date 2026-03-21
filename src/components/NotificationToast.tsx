import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  created_at: string;
}

export const NotificationToast = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<RealtimeNotification[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-notifications-toast')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'realtime_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as RealtimeNotification;
          setToasts((prev) => [...prev, notification]);

          // Auto-dismiss after 10 seconds
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== notification.id));
          }, 10000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // Mark as read
    supabase
      .from('realtime_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .then();
  };

  const handleNavigate = (notification: RealtimeNotification) => {
    dismissToast(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="bg-card border border-border rounded-lg shadow-lg p-4 w-80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{toast.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {toast.link && (
              <button
                onClick={() => handleNavigate(toast)}
                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver detalhes
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
            {/* Progress bar for auto-dismiss */}
            <motion.div
              className="h-0.5 bg-primary/30 rounded-full mt-2"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 10, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
