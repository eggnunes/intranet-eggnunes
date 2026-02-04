import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  conversation_name?: string;
}

export const useMessageNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const processedMessages = useRef<Set<string>>(new Set());

  // Fetch unread messages count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      // Get all conversations the user participates in
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Count unread messages across all conversations
      let totalUnread = 0;

      for (const participation of participations) {
        const { count, error } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', participation.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', participation.last_read_at || '1970-01-01');

        if (!error && count) {
          totalUnread += count;
        }
      }

      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user]);

  // Get sender name
  const getSenderName = async (senderId: string): Promise<string> => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single();
    
    return data?.full_name || 'Alguém';
  };

  // Get conversation display name
  const getConversationName = async (conversationId: string, senderId: string): Promise<string> => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('name, is_group')
      .eq('id', conversationId)
      .single();

    if (conv?.is_group && conv?.name) {
      return conv.name;
    }

    // For 1-1 conversations, get the other person's name
    const senderName = await getSenderName(senderId);
    return senderName;
  };

  // Show notification pop-up
  const showNotification = useCallback(async (message: NewMessage) => {
    // Don't show notification if already on mensagens page with this conversation
    if (location.pathname === '/mensagens') {
      // Still update count but don't show toast
      fetchUnreadCount();
      return;
    }

    const senderName = await getSenderName(message.sender_id);
    const conversationName = await getConversationName(message.conversation_id, message.sender_id);
    
    // Truncate message content
    const truncatedContent = message.content.length > 50 
      ? message.content.substring(0, 50) + '...' 
      : message.content;

    // Show toast notification with action button
    toast.custom(
      (t) => (
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm w-full">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Nova mensagem de {senderName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {conversationName}
              </p>
              <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
                {truncatedContent}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  toast.dismiss(t);
                  navigate('/mensagens', { 
                    state: { openConversation: message.conversation_id } 
                  });
                }}
              >
                Responder
              </Button>
            </div>
            <button
              onClick={() => toast.dismiss(t)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <span className="sr-only">Fechar</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ),
      {
        duration: 8000,
        position: 'top-right',
      }
    );

    // Play notification sound (optional)
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (user hasn't interacted yet)
      });
    } catch {
      // Ignore audio errors
    }
  }, [location.pathname, navigate, fetchUnreadCount]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchUnreadCount();

    // Get user's conversation IDs first
    const setupSubscription = async () => {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) return;

      const conversationIds = participations.map(p => p.conversation_id);

      // Subscribe to new messages in user's conversations
      const channel = supabase
        .channel('message-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMessage = payload.new as NewMessage;
            
            // Check if this message is for a conversation the user is in
            if (!conversationIds.includes(newMessage.conversation_id)) {
              return;
            }

            // Don't notify for own messages
            if (newMessage.sender_id === user.id) {
              return;
            }

            // Check if we already processed this message
            if (processedMessages.current.has(newMessage.id)) {
              return;
            }
            processedMessages.current.add(newMessage.id);

            // Keep the set from growing indefinitely
            if (processedMessages.current.size > 100) {
              const arr = Array.from(processedMessages.current);
              processedMessages.current = new Set(arr.slice(-50));
            }

            // Show notification
            await showNotification(newMessage);
            
            // Update unread count
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [user, fetchUnreadCount, showNotification]);

  // Refresh conversations list when URL changes
  useEffect(() => {
    if (location.pathname === '/mensagens') {
      // Reset unread count when on messages page
      setTimeout(() => fetchUnreadCount(), 1000);
    }
  }, [location.pathname, fetchUnreadCount]);

  return {
    unreadCount,
    refetchUnreadCount: fetchUnreadCount,
  };
};
