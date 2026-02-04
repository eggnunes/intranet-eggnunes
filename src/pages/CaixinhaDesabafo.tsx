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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  User,
  UserX,
  Calendar,
  Forward,
  Send,
  ChevronDown,
  ChevronUp,
  Shield,
  Inbox,
  PenSquare
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

const CaixinhaDesabafo = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [myMessages, setMyMessages] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<FeedbackMessage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSocio, setIsSocio] = useState(false);
  const [showSender, setShowSender] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('enviar');
  
  // Form state
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  
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

  // Check if user is sócio
  useEffect(() => {
    const checkSocio = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('position, email')
        .eq('id', user.id)
        .single();

      const isSocioUser = data?.position === 'socio' || data?.email === 'rafael@eggnunes.com.br';
      setIsSocio(isSocioUser);
      
      // Set default tab based on role
      if (isSocioUser) {
        setActiveTab('recebidas');
      }
    };

    checkSocio();
  }, [user]);

  // Fetch sócios for forwarding
  useEffect(() => {
    const fetchSocios = async () => {
      if (!isSocio) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position, email')
        .eq('position', 'socio')
        .eq('approval_status', 'approved')
        .neq('id', user?.id || '');
      
      setSocios(data || []);
    };

    fetchSocios();
  }, [isSocio, user?.id]);

  // Fetch messages (all for sócios, own for regular users)
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // For regular users, only fetch their own messages
        const { data: ownMessages, error: ownError } = await supabase
          .from('feedback_box')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        if (ownError) {
          console.error('Error fetching own messages:', ownError);
        } else {
          setMyMessages(ownMessages || []);
        }

        // For sócios, also fetch all messages
        if (isSocio) {
          const { data, error } = await supabase
            .from('feedback_box')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          // Fetch sender profiles
          const senderIds = data?.map(m => m.sender_id) || [];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, position, email')
            .in('id', senderIds);

          const enrichedMessages = data?.map(msg => ({
            ...msg,
            sender: profiles?.find(p => p.id === msg.sender_id)
          })) || [];

          setMessages(enrichedMessages);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Erro ao carregar mensagens');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, isSocio]);

  // Fetch replies for selected message
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

  // Reset state when selecting different message
  useEffect(() => {
    setShowSender(false);
    setShowReplies(false);
    setReplyText('');
  }, [selectedMessage?.id]);

  // Send new message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!subject.trim() || !messageText.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }

    try {
      setSending(true);

      const { data: newMessage, error } = await supabase
        .from('feedback_box')
        .insert({
          sender_id: user.id,
          subject: subject.trim(),
          message: messageText.trim(),
          is_anonymous: isAnonymous
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification for Rafael and other sócios
      const { data: sociosProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or('email.eq.rafael@eggnunes.com.br,position.eq.socio');

      if (sociosProfiles) {
        for (const socio of sociosProfiles) {
          if (socio.id !== user.id) {
            await supabase
              .from('user_notifications')
              .insert({
                user_id: socio.id,
                title: 'Nova mensagem na Caixinha de Desabafo',
                message: isAnonymous 
                  ? `Mensagem anônima: ${subject}` 
                  : `Mensagem de ${user.user_metadata?.full_name || 'um colaborador'}: ${subject}`,
                type: 'feedback',
                action_url: '/caixinha-desabafo'
              });
          }
        }
      }

      // Add to my messages list
      if (newMessage) {
        setMyMessages(prev => [newMessage, ...prev]);
      }

      toast.success('Mensagem enviada com sucesso!');
      setSubject('');
      setMessageText('');
      setIsAnonymous(false);
      setActiveTab('minhas');
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

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

  const unreadCount = messages.filter(m => !m.is_read).length;

  // Render message card component
  const MessageCard = ({ msg, isOwn = false }: { msg: FeedbackMessage; isOwn?: boolean }) => (
    <button
      onClick={() => {
        setSelectedMessage(msg);
        if (!msg.is_read && isSocio) handleMarkAsRead(msg.id);
      }}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        selectedMessage?.id === msg.id
          ? 'border-primary bg-primary/5'
          : 'hover:bg-muted'
      } ${!msg.is_read && !isOwn ? 'border-l-4 border-l-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOwn && (msg.is_read ? (
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Circle className="h-4 w-4 text-primary fill-primary" />
          ))}
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
          {isOwn ? (
            <>
              <User className="h-3 w-3" />
              <span>Enviada por você</span>
            </>
          ) : (
            <>
              <UserX className="h-3 w-3" />
              <span>Remetente Anônimo</span>
            </>
          )}
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
  );

  // Render message detail for user's own messages (view only)
  const MessageDetailOwn = ({ msg }: { msg: FeedbackMessage }) => (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-muted-foreground">Assunto</label>
        <p className="text-lg font-semibold mt-1">{msg.subject}</p>
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">Sua Mensagem</label>
        <div className="mt-2 p-4 rounded-lg bg-muted/50 whitespace-pre-wrap">
          {msg.message}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Badge variant={msg.is_anonymous ? 'secondary' : 'outline'}>
          {msg.is_anonymous ? 'Enviada anonimamente' : 'Identificada'}
        </Badge>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
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
            {replies.length} resposta{replies.length > 1 ? 's' : ''} da administração
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
    </div>
  );

  // Render message detail for sócios (with management)
  const MessageDetailSocio = ({ msg }: { msg: FeedbackMessage }) => (
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
                  <p className="font-medium">{msg.sender?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {msg.sender?.position} • {msg.sender?.email}
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
        <label className="text-sm font-medium text-muted-foreground">Assunto</label>
        <p className="text-lg font-semibold mt-1">{msg.subject}</p>
      </div>

      {/* Message */}
      <div>
        <label className="text-sm font-medium text-muted-foreground">Mensagem</label>
        <div className="mt-2 p-4 rounded-lg bg-muted/50 whitespace-pre-wrap">
          {msg.message}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR
            })}
          </span>
        </div>
        {msg.is_read && msg.read_at && (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            <span>
              Lida em {format(new Date(msg.read_at), 'dd/MM HH:mm')}
            </span>
          </div>
        )}
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
          Responder mensagem
        </label>
        <div className="flex gap-2">
          <Textarea
            placeholder="Digite sua resposta..."
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
          Enviar Resposta
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForwardDialogOpen(true)}
        >
          <Forward className="h-4 w-4 mr-2" />
          Encaminhar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteId(msg.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquareHeart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Caixinha de Desabafo</h1>
              <p className="text-muted-foreground">
                {isSocio ? 'Gerencie as mensagens dos colaboradores' : 'Fale com os sócios de forma confidencial'}
              </p>
            </div>
          </div>

          {isSocio && unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: isSocio ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
            <TabsTrigger value="enviar" className="gap-2">
              <PenSquare className="h-4 w-4" />
              Enviar
            </TabsTrigger>
            <TabsTrigger value="minhas" className="gap-2">
              <Inbox className="h-4 w-4" />
              Minhas Mensagens
              {myMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {myMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            {isSocio && (
              <TabsTrigger value="recebidas" className="gap-2">
                <MessageSquareHeart className="h-4 w-4" />
                Recebidas
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Send Message Tab */}
          <TabsContent value="enviar" className="mt-6">
            <Card className="max-w-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg">Nova Mensagem</CardTitle>
                <CardDescription>
                  Envie sua mensagem, sugestão, desabafo ou reclamação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Assunto</Label>
                    <Input
                      id="subject"
                      placeholder="Sobre o que você quer falar?"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={sending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Sua mensagem</Label>
                    <Textarea
                      id="message"
                      placeholder="Escreva aqui sua mensagem, sugestão, desabafo ou reclamação..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={5}
                      disabled={sending}
                      className="resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      {isAnonymous ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <Label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                          Enviar anonimamente
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Sua identidade não será revelada
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={setIsAnonymous}
                      disabled={sending}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    <span>Suas mensagens são tratadas com confidencialidade</span>
                  </div>

                  <Button type="submit" className="w-full" disabled={sending}>
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? 'Enviando...' : 'Enviar Mensagem'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Messages Tab */}
          <TabsContent value="minhas" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Suas Mensagens Enviadas</CardTitle>
                  <CardDescription>
                    {myMessages.length} mensagen{myMessages.length !== 1 ? 's' : ''} enviada{myMessages.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-24 w-full" />
                        ))}
                      </div>
                    ) : myMessages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquareHeart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Você ainda não enviou nenhuma mensagem</p>
                        <Button
                          variant="link"
                          onClick={() => setActiveTab('enviar')}
                          className="mt-2"
                        >
                          Enviar primeira mensagem
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myMessages.map(msg => (
                          <MessageCard key={msg.id} msg={msg} isOwn />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalhes da Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedMessage && myMessages.some(m => m.id === selectedMessage.id) ? (
                    <MessageDetailOwn msg={selectedMessage} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Selecione uma mensagem para ver os detalhes</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Received Messages Tab (Sócios only) */}
          {isSocio && (
            <TabsContent value="recebidas" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            <MessageCard key={msg.id} msg={msg} />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalhes da Mensagem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedMessage && messages.some(m => m.id === selectedMessage.id) ? (
                      <MessageDetailSocio msg={selectedMessage} />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Selecione uma mensagem para ver os detalhes</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar Mensagem</DialogTitle>
            <DialogDescription>
              Encaminhe esta mensagem para outro sócio. {selectedMessage?.is_anonymous && 'A identidade do remetente não será revelada.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Encaminhar para</label>
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
            
            <div>
              <label className="text-sm font-medium mb-2 block">Nota (opcional)</label>
              <Textarea
                placeholder="Adicione uma nota ao encaminhamento..."
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleForward} disabled={forwarding || !forwardTo}>
              <Forward className="h-4 w-4 mr-2" />
              Encaminhar
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default CaixinhaDesabafo;
