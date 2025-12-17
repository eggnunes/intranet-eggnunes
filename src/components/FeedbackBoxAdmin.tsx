import { useState, useEffect } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquareHeart,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  Circle,
  UserX,
  Calendar,
  Forward,
  Reply,
  Send,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FeedbackMessage {
  id: string;
  sender_id: string;
  is_anonymous: boolean;
  subject: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
    position: string | null;
    email: string;
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

interface Profile {
  id: string;
  full_name: string;
  position: string | null;
  email: string;
}

export const FeedbackBoxAdmin = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<FeedbackMessage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSender, setShowSender] = useState(false);
  
  // Forward state
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState<string>('');
  const [forwardNote, setForwardNote] = useState('');
  const [socios, setSocios] = useState<Profile[]>([]);
  const [forwarding, setForwarding] = useState(false);
  
  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  useEffect(() => {
    const fetchSocios = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position, email')
        .eq('position', 'socio')
        .eq('approval_status', 'approved')
        .neq('email', 'rafael@eggnunes.com.br');
      
      setSocios(data || []);
    };

    fetchSocios();
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('feedback_box')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch sender profiles
        const senderIds = data?.map(m => m.sender_id) || [];
        if (senderIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, position, email')
            .in('id', senderIds);

          const enrichedMessages = data?.map(msg => ({
            ...msg,
            sender: profiles?.find(p => p.id === msg.sender_id)
          })) || [];

          setMessages(enrichedMessages);
        } else {
          setMessages(data || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Erro ao carregar mensagens');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    const fetchReplies = async () => {
      if (!selectedMessage) {
        setReplies([]);
        return;
      }

      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', selectedMessage.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching replies:', error);
        return;
      }

      const senderIds = data?.map(r => r.sender_id) || [];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds);

        const enrichedReplies = data?.map(reply => ({
          ...reply,
          sender: profiles?.find(p => p.id === reply.sender_id)
        })) || [];

        setReplies(enrichedReplies);
      } else {
        setReplies(data || []);
      }
    };

    fetchReplies();
  }, [selectedMessage]);

  useEffect(() => {
    setShowSender(false);
    setShowReplies(false);
    setReplyText('');
  }, [selectedMessage?.id]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feedback_box')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setMessages(prev =>
        prev.map(m =>
          m.id === id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Erro ao marcar como lida');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('feedback_box')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== deleteId));
      toast.success('Mensagem excluída');
      setDeleteId(null);
      if (selectedMessage?.id === deleteId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erro ao excluir mensagem');
    }
  };

  const handleForward = async () => {
    if (!selectedMessage || !forwardTo) return;

    setForwarding(true);
    try {
      const { error } = await supabase
        .from('feedback_forwards')
        .insert({
          feedback_id: selectedMessage.id,
          forwarded_to: forwardTo,
          forwarded_by: user?.id,
          note: forwardNote || null
        });

      if (error) throw error;

      toast.success('Mensagem encaminhada com sucesso');
      setForwardDialogOpen(false);
      setForwardTo('');
      setForwardNote('');
    } catch (error) {
      console.error('Error forwarding message:', error);
      toast.error('Erro ao encaminhar mensagem');
    } finally {
      setForwarding(false);
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setReplying(true);
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert({
          feedback_id: selectedMessage.id,
          sender_id: user?.id,
          message: replyText.trim()
        })
        .select()
        .single();

      if (error) throw error;

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

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquareHeart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Caixinha de Desabafo</h2>
            <p className="text-sm text-muted-foreground">
              Mensagens dos colaboradores
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
              {messages.length} mensagen{messages.length !== 1 ? 's' : ''} no total
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
                  <p>Nenhuma mensagem recebida</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => (
                    <button
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg);
                        if (!msg.is_read) handleMarkAsRead(msg.id);
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
                          <span className="font-medium truncate">{msg.subject}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {msg.is_anonymous ? (
                            <EyeOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {msg.message}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          <span>Remetente Anônimo</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", {
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
                {/* Sender Info - Hidden by default */}
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <UserX className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        {showSender ? (
                          <>
                            <p className="font-medium">{selectedMessage.sender?.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedMessage.sender?.position} • {selectedMessage.sender?.email}
                            </p>
                          </>
                        ) : (
                          <p className="font-medium text-muted-foreground">Remetente Anônimo</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSender(!showSender)}
                      className="text-xs h-7 px-2"
                    >
                      {showSender ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <h3 className="font-semibold text-lg">{selectedMessage.subject}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(selectedMessage.created_at), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR
                    })}
                  </p>
                </div>

                {/* Message Content */}
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>

                {/* Replies Section */}
                {replies.length > 0 && (
                  <div className="space-y-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReplies(!showReplies)}
                      className="w-full justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Reply className="h-4 w-4" />
                        {replies.length} resposta{replies.length > 1 ? 's' : ''}
                      </span>
                      {showReplies ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {showReplies && (
                      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                        {replies.map(reply => (
                          <div key={reply.id} className="p-3 rounded-lg bg-primary/5 border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{reply.sender?.full_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(reply.created_at), "dd/MM 'às' HH:mm", {
                                  locale: ptBR
                                })}
                              </span>
                            </div>
                            <p className="text-sm">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reply Input */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Digite sua resposta..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={!replyText.trim() || replying}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {replying ? 'Enviando...' : 'Responder'}
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForwardDialogOpen(true)}
                    className="gap-2"
                  >
                    <Forward className="h-4 w-4" />
                    Encaminhar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteId(selectedMessage.id)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
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

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar Mensagem</DialogTitle>
            <DialogDescription>
              Encaminhe esta mensagem para outro sócio. {selectedMessage?.is_anonymous && 'A identidade do remetente será mantida anônima.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Encaminhar para</label>
              <Select value={forwardTo} onValueChange={setForwardTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sócio" />
                </SelectTrigger>
                <SelectContent>
                  {socios.map(socio => (
                    <SelectItem key={socio.id} value={socio.id}>
                      {socio.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Textarea
                placeholder="Adicione uma nota ao encaminhar..."
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleForward} disabled={!forwardTo || forwarding}>
              {forwarding ? 'Encaminhando...' : 'Encaminhar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
