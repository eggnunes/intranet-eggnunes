import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Clock, FileText, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatArea, InternalComment } from '@/components/whatsapp/ChatArea';
import { ScheduledMessages } from '@/components/whatsapp/ScheduledMessages';
import { TemplatesManager } from '@/components/whatsapp/TemplatesManager';
import { TagsManager } from '@/components/whatsapp/TagsManager';

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
  sector?: string | null;
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
  sent_by?: string | null;
  transcription?: string | null;
}

export default function WhatsAppAvisos() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<InternalComment[]>([]);
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
    const [messagesRes, commentsRes] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('whatsapp_internal_comments')
        .select('*, profiles!whatsapp_internal_comments_author_id_fkey(full_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    ]);

    if (messagesRes.data) {
      setMessages(messagesRes.data as Message[]);
    }

    if (commentsRes.data) {
      setComments(
        commentsRes.data.map((c: any) => ({
          id: c.id,
          conversation_id: c.conversation_id,
          author_id: c.author_id,
          author_name: c.profiles?.full_name || 'Desconhecido',
          content: c.content,
          created_at: c.created_at,
          _type: 'comment' as const,
        }))
      );
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
        if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
        fetchConversations();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_internal_comments',
      }, (payload) => {
        const newComment = payload.new as any;
        if (selectedConversation && newComment.conversation_id === selectedConversation.id) {
          // Fetch author name for the new comment
          supabase.from('profiles').select('full_name').eq('id', newComment.author_id).single().then(({ data }) => {
            const comment: InternalComment = {
              id: newComment.id,
              conversation_id: newComment.conversation_id,
              author_id: newComment.author_id,
              author_name: data?.full_name || 'Desconhecido',
              content: newComment.content,
              created_at: newComment.created_at,
              _type: 'comment',
            };
            setComments(prev => {
              if (prev.some(c => c.id === comment.id)) return prev;
              return [...prev, comment];
            });
          });
        }
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

    const bodyMap: Record<string, any> = {
      text: { action: 'send-message', phone: selectedConversation.phone, message: content, skipFooter: true },
      audio: { action: 'send-audio', phone: selectedConversation.phone, audioUrl: mediaUrl },
      image: { action: 'send-image', phone: selectedConversation.phone, imageUrl: mediaUrl, caption: content },
      document: { action: 'send-document', phone: selectedConversation.phone, documentUrl: mediaUrl, filename },
    };

    const { data, error } = await supabase.functions.invoke('zapi-send-message', {
      body: bodyMap[type],
    });

    if (error) throw error;

    await fetchMessages(selectedConversation.id);
    await fetchConversations();
    return data;
  }, [selectedConversation, fetchMessages, fetchConversations]);

  const handleCommentSent = useCallback(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  const handleConversationUpdated = useCallback((updates: Partial<Conversation>) => {
    if (!selectedConversation) return;
    const updated = { ...selectedConversation, ...updates };
    setSelectedConversation(updated);
    setConversations(prev =>
      prev.map(c => c.id === updated.id ? { ...c, ...updates } : c)
    );
  }, [selectedConversation]);

  const handleNewConversation = useCallback(async (phone: string, contactName?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

    const existing = conversations.find(c => c.phone === fullPhone);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .insert({ phone: fullPhone, contact_name: contactName || null, unread_count: 0 })
      .select()
      .single();

    if (!error && data) {
      const newConv = data as Conversation;
      setConversations(prev => [newConv, ...prev]);
      setSelectedConversation(newConv);
      setMessages([]);
      setComments([]);
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
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversas" className="mt-4">
            <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg overflow-hidden bg-card">
              <div className="w-80 min-w-[280px] border-r flex-shrink-0">
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedConversation?.id || null}
                  onSelect={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  loading={loadingConversations}
                />
              </div>
              <div className="flex-1 min-w-0">
                <ChatArea
                  conversation={selectedConversation}
                  messages={messages}
                  comments={comments}
                  loading={loadingMessages}
                  onSendMessage={handleSendMessage}
                  userId={user?.id || ''}
                  onCommentSent={handleCommentSent}
                  onConversationUpdated={handleConversationUpdated}
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

          <TabsContent value="tags" className="mt-4">
            <TagsManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
