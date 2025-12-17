import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquareHeart,
  CheckCircle,
  Circle,
  UserX,
  Calendar,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  Forward
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ForwardedMessage {
  id: string;
  feedback_id: string;
  forwarded_at: string;
  is_read: boolean;
  read_at: string | null;
  note: string | null;
  forwarded_by_name?: string;
  feedback?: {
    subject: string;
    message: string;
    created_at: string;
  };
}

interface FeedbackReply {
  id: string;
  feedback_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

const MensagensEncaminhadas = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ForwardedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ForwardedMessage | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  
  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('position')
        .eq('id', user.id)
        .single();

      // Only sócios can access this page
      setHasAccess(data?.position === 'socio');
    };

    checkAccess();
  }, [user]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!hasAccess || !user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch forwarded messages for this user
        const { data: forwards, error } = await supabase
          .from('feedback_forwards')
          .select('*')
          .eq('forwarded_to', user.id)
          .order('forwarded_at', { ascending: false });

        if (error) throw error;

        if (!forwards || forwards.length === 0) {
          setMessages([]);
          setLoading(false);
          return;
        }

        // Fetch the actual feedback messages
        const feedbackIds = forwards.map(f => f.feedback_id);
        const { data: feedbacks } = await supabase
          .from('feedback_box')
          .select('id, subject, message, created_at')
          .in('id', feedbackIds);

        // Fetch forwarder names
        const forwarderIds = forwards.map(f => f.forwarded_by);
        const { data: forwarders } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', forwarderIds);

        const enrichedMessages = forwards.map(fwd => ({
          ...fwd,
          feedback: feedbacks?.find(f => f.id === fwd.feedback_id),
          forwarded_by_name: forwarders?.find(f => f.id === fwd.forwarded_by)?.full_name
        }));

        setMessages(enrichedMessages);
      } catch (error) {
        console.error('Error fetching forwarded messages:', error);
        toast.error('Erro ao carregar mensagens');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [hasAccess, user]);

  useEffect(() => {
    const fetchReplies = async () => {
      if (!selectedMessage?.feedback_id) {
        setReplies([]);
        return;
      }

      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', selectedMessage.feedback_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching replies:', error);
        return;
      }

      // Enrich with sender info
      const senderIds = data?.map(r => r.sender_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const enrichedReplies = data?.map(reply => ({
        ...reply,
        sender: profiles?.find(p => p.id === reply.sender_id)
      })) || [];

      setReplies(enrichedReplies);
    };

    fetchReplies();
  }, [selectedMessage]);

  // Reset when selecting a different message
  useEffect(() => {
    setShowReplies(false);
    setReplyText('');
  }, [selectedMessage?.id]);

  const handleMarkAsRead = async (forward: ForwardedMessage) => {
    if (forward.is_read) return;

    try {
      const { error } = await supabase
        .from('feedback_forwards')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', forward.id);

      if (error) throw error;

      setMessages(prev =>
        prev.map(m =>
          m.id === forward.id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setReplying(true);
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert({
          feedback_id: selectedMessage.feedback_id,
          sender_id: user?.id,
          message: replyText.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Add to replies list
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      setReplies(prev => [...prev, { ...data, sender: profile }]);
      setReplyText('');
      toast.success('Resposta enviada');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Erro ao enviar resposta');
    } finally {
      setReplying(false);
    }
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Esta página é acessível apenas para sócios.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Forward className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mensagens Encaminhadas</h1>
              <p className="text-muted-foreground">
                Mensagens da caixinha de desabafo encaminhadas para você
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mensagens Recebidas</CardTitle>
              <CardDescription>
                {messages.length} mensagen{messages.length !== 1 ? 's' : ''} encaminhada{messages.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquareHeart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma mensagem encaminhada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          setSelectedMessage(msg);
                          handleMarkAsRead(msg);
                        }}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedMessage?.id === msg.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        } ${!msg.is_read ? 'border-l-4 border-l-primary' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {msg.is_read ? (
                              <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Circle className="h-4 w-4 text-primary fill-primary" />
                            )}
                            <span className="font-medium truncate">{msg.feedback?.subject}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {msg.feedback?.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Forward className="h-3 w-3" />
                            <span>Por {msg.forwarded_by_name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(msg.forwarded_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR
                              })}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhes da Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMessage ? (
                <div className="space-y-6">
                  {/* Sender Info - Always anonymous */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <UserX className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Remetente Anônimo</p>
                        <p className="text-sm text-muted-foreground">
                          Encaminhado por {selectedMessage.forwarded_by_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Forward Note */}
                  {selectedMessage.note && (
                    <div className="p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                      <p className="text-sm font-medium mb-1">Nota do encaminhamento:</p>
                      <p className="text-sm">{selectedMessage.note}</p>
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assunto</label>
                    <p className="text-lg font-semibold mt-1">{selectedMessage.feedback?.subject}</p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mensagem</label>
                    <div className="mt-2 p-4 rounded-lg bg-muted/50 whitespace-pre-wrap">
                      {selectedMessage.feedback?.message}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Enviado em {format(new Date(selectedMessage.feedback?.created_at || ''), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Replies Section */}
                  {replies.length > 0 && (
                    <div className="border-t pt-4">
                      <button
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        {showReplies ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {replies.length} resposta{replies.length > 1 ? 's' : ''}
                      </button>
                      
                      {showReplies && (
                        <div className="mt-3 space-y-3">
                          {replies.map(reply => (
                            <div key={reply.id} className="p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{reply.sender?.full_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(reply.created_at), "dd/MM 'às' HH:mm")}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reply Input */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Adicionar comentário
                    </label>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Digite seu comentário..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      className="mt-2"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquareHeart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione uma mensagem para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MensagensEncaminhadas;
