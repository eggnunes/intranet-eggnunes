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
  MessageSquareHeart,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  Circle,
  User,
  UserX,
  Calendar,
  AlertTriangle
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

const CaixinhaDesabafo = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<FeedbackMessage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isRafael, setIsRafael] = useState(false);

  useEffect(() => {
    const checkRafael = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      setIsRafael(data?.email === 'rafael@eggnunes.com.br');
    };

    checkRafael();
  }, [user]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!isRafael) {
        setLoading(false);
        return;
      }

      try {
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
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Erro ao carregar mensagens');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [isRafael]);

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

  if (!isRafael) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Esta página é acessível apenas para administração.
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
              <MessageSquareHeart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Caixinha de Desabafo</h1>
              <p className="text-muted-foreground">
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
                            {msg.is_anonymous ? (
                              <UserX className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            <span>
                              {msg.is_anonymous ? 'Anônimo' : msg.sender?.full_name}
                            </span>
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
                  {/* Sender Info - Always visible for Rafael */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Remetente</span>
                      {selectedMessage.is_anonymous && (
                        <Badge variant="outline" className="text-orange-500 border-orange-500">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Anônimo (visível só para você)
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedMessage.sender?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedMessage.sender?.position} • {selectedMessage.sender?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assunto</label>
                    <p className="text-lg font-semibold mt-1">{selectedMessage.subject}</p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mensagem</label>
                    <div className="mt-2 p-4 rounded-lg bg-muted/50 whitespace-pre-wrap">
                      {selectedMessage.message}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(selectedMessage.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    {selectedMessage.is_read && selectedMessage.read_at && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          Lida em {format(new Date(selectedMessage.read_at), 'dd/MM HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(selectedMessage.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Mensagem
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione uma mensagem para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
