import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited?: boolean;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export const useMessaging = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch all conversations for the user
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      // Get conversation details
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      // Get participants for each conversation
      const { data: allParticipants, error: allPartError } = await supabase
        .from('conversation_participants')
        .select('*')
        .in('conversation_id', conversationIds);

      if (allPartError) throw allPartError;

      // Get profiles for all participants
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get last message for each conversation
      const { data: lastMessages, error: lastMsgError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (lastMsgError) throw lastMsgError;

      // Map data
      const enrichedConversations = convData?.map(conv => {
        const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];
        const enrichedParticipants = convParticipants.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id)
        }));

        const lastMessage = lastMessages?.find(m => m.conversation_id === conv.id);
        
        // Count unread messages
        const myParticipation = convParticipants.find(p => p.user_id === user.id);
        const unreadCount = lastMessages?.filter(
          m => m.conversation_id === conv.id && 
               new Date(m.created_at) > new Date(myParticipation?.last_read_at || 0) &&
               m.sender_id !== user.id
        ).length || 0;

        return {
          ...conv,
          participants: enrichedParticipants,
          last_message: lastMessage,
          unread_count: unreadCount
        };
      }) || [];

      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      setLoadingMessages(true);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      if (profilesError) throw profilesError;

      const enrichedMessages = data?.map(msg => ({
        ...msg,
        sender: profiles?.find(p => p.id === msg.sender_id)
      })) || [];

      setMessages(enrichedMessages);

      // Mark as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  // Send a message
  const sendMessage = async (conversationId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Create notification for other participants
      const conversation = conversations.find(c => c.id === conversationId);
      const otherParticipants = conversation?.participants?.filter(p => p.user_id !== user.id) || [];

      for (const participant of otherParticipants) {
        await supabase
          .from('user_notifications')
          .insert({
            user_id: participant.user_id,
            title: 'Nova mensagem',
            message: `${user.user_metadata?.full_name || 'Alguém'} enviou uma mensagem`,
            type: 'message',
            action_url: '/mensagens'
          });
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      throw error;
    }
  };

  // Create a new conversation
  const createConversation = async (participantIds: string[], name?: string, isGroup = false) => {
    if (!user) return;

    try {
      // Check if 1-1 conversation already exists
      if (!isGroup && participantIds.length === 1) {
        const existingConv = conversations.find(conv => 
          !conv.is_group && 
          conv.participants?.length === 2 &&
          conv.participants.some(p => p.user_id === participantIds[0])
        );

        if (existingConv) {
          return existingConv;
        }
      }

      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: isGroup ? name : null,
          is_group: isGroup,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants (including creator)
      const allParticipants = [user.id, ...participantIds];
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(
          allParticipants.map(uid => ({
            conversation_id: conv.id,
            user_id: uid
          }))
        );

      if (partError) throw partError;

      await fetchConversations();
      return conv;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
      throw error;
    }
  };

  // Delete a conversation (for sócios)
  const deleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      // First delete all messages
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Then delete participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Finally delete the conversation
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      toast.success('Conversa excluída');
      setActiveConversation(null);
      await fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao excluir conversa');
    }
  };

  // Edit a message (only within 5 minutes)
  const editMessage = async (messageId: string, newContent: string) => {
    if (!user || !newContent.trim()) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: newContent.trim(),
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent.trim(), is_edited: true }
          : msg
      ));

      toast.success('Mensagem editada');
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Erro ao editar mensagem');
      return false;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // If it's for the active conversation, add to messages
          if (activeConversation && newMessage.conversation_id === activeConversation.id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            setMessages(prev => [...prev, { ...newMessage, sender: senderProfile }]);

            // Mark as read if not my message
            if (newMessage.sender_id !== user.id) {
              await supabase
                .from('conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', newMessage.conversation_id)
                .eq('user_id', user.id);
            }
          }

          // Refresh conversations list
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversation, fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation, fetchMessages]);

  return {
    conversations,
    loading,
    activeConversation,
    setActiveConversation,
    messages,
    loadingMessages,
    sendMessage,
    createConversation,
    fetchConversations,
    fetchMessages,
    deleteConversation,
    editMessage
  };
};
