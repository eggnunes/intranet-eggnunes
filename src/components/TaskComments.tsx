import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    getCurrentUser();

    // Realtime subscription
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchComments = async () => {
    try {
      // Buscar comentários
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Buscar perfis dos usuários
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        // Mesclar dados
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesData?.find(p => p.id === comment.user_id),
        }));

        setComments(commentsWithProfiles as Comment[]);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      toast({
        title: 'Comentário adicionado',
        description: 'Seu comentário foi publicado com sucesso.',
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Erro ao publicar comentário',
        description: 'Não foi possível adicionar seu comentário.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: 'Comentário removido',
        description: 'O comentário foi deletado com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Erro ao remover comentário',
        description: 'Não foi possível deletar o comentário.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando comentários...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        Comentários ({comments.length})
      </div>

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum comentário ainda. Seja o primeiro a comentar!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8">
                  {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt={comment.profiles.full_name} />
                  ) : (
                    <div className="bg-primary text-primary-foreground flex items-center justify-center h-full w-full text-sm">
                      {comment.profiles?.full_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.profiles?.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {(isAdmin || comment.user_id === currentUserId) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 pt-4 border-t">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva seu comentário..."
          rows={3}
          className="resize-none"
        />
        <Button
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || submitting}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Enviando...' : 'Enviar Comentário'}
        </Button>
      </div>
    </div>
  );
}
