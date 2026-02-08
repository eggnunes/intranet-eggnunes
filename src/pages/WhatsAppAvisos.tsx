import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatArea } from '@/components/whatsapp/ChatArea';
import { ScheduledMessages } from '@/components/whatsapp/ScheduledMessages';
import { TemplatesManager } from '@/components/whatsapp/TemplatesManager';

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  phone: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  status: string;
  is_from_me: boolean;
  created_at: string;
  zapi_message_id: string | null;
}

export default function WhatsAppAvisos() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setConversations(data as Conversation[]);
    }
    setLoadingConversations(false);
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data as Message[]);
    }
    setLoadingMessages(false);
  }, []);

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConversation(conv);
    await fetchMessages(conv.id);

    // Mark as read
    if (conv.unread_count > 0) {
      await supabase.functions.invoke('zapi-send-message', {
        body: { action: 'mark-read', conversationId: conv.id },
      });
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    }
  }, [fetchMessages]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const newMsg = payload.new as Message;

        // Update messages if we're viewing this conversation
        if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
          setMessages(prev => {
            // Check for duplicate
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }

        // Update conversations list
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, fetchConversations]);

  const handleSendMessage = useCallback(async (
    type: 'text' | 'audio' | 'image' | 'document',
    content: string,
    mediaUrl?: string,
    filename?: string,
  ) => {
    if (!selectedConversation) return;

    const actionMap = {
      text: 'send-message',
      audio: 'send-audio',
      image: 'send-image',
      document: 'send-document',
    };

    const bodyMap: Record<string, any> = {
      text: { action: 'send-message', phone: selectedConversation.phone, message: content, skipFooter: true },
      audio: { action: 'send-audio', phone: selectedConversation.phone, audioUrl: mediaUrl },
      image: { action: 'send-image', phone: selectedConversation.phone, imageUrl: mediaUrl, caption: content },
      document: { action: 'send-document', phone: selectedConversation.phone, documentUrl: mediaUrl, filename },
    };

    const { data, error } = await supabase.functions.invoke('zapi-send-message', {
      body: bodyMap[type],
    });

    if (error) {
      throw error;
    }

    // Refresh messages and conversations
    await fetchMessages(selectedConversation.id);
    await fetchConversations();

    return data;
  }, [selectedConversation, fetchMessages, fetchConversations]);

  const handleNewConversation = useCallback(async (phone: string, contactName?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

    // Check if conversation already exists
    const existing = conversations.find(c => c.phone === fullPhone);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        phone: fullPhone,
        contact_name: contactName || null,
        unread_count: 0,
      })
      .select()
      .single();

    if (!error && data) {
      const newConv = data as Conversation;
      setConversations(prev => [newConv, ...prev]);
      setSelectedConversation(newConv);
      setMessages([]);
    }
  }, [conversations, handleSelectConversation]);

  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Avisos</h1>
          <p className="text-muted-foreground text-sm">Gerencie mensagens WhatsApp com clientes</p>
        </div>

        <Tabs defaultValue="conversas" className="w-full">
          <TabsList>
            <TabsTrigger value="conversas" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="agendadas" className="gap-2">
              <Clock className="h-4 w-4" />
              Agendadas
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversas" className="mt-4">
            <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg overflow-hidden bg-card">
              {/* Conversation List - left side */}
              <div className="w-80 min-w-[280px] border-r flex-shrink-0">
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedConversation?.id || null}
                  onSelect={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  loading={loadingConversations}
                />
              </div>

              {/* Chat Area - right side */}
              <div className="flex-1 min-w-0">
                <ChatArea
                  conversation={selectedConversation}
                  messages={messages}
                  loading={loadingMessages}
                  onSendMessage={handleSendMessage}
                  userId={user?.id || ''}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agendadas" className="mt-4">
            <ScheduledMessages />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <TemplatesManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
