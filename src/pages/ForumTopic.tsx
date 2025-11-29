import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Clock, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Post {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
}

interface Topic {
  id: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
}

export default function ForumTopic() {
  const { id } = useParams();
  const { isApproved, loading, isAdmin, profile } = useUserRole();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isApproved && id) {
      fetchTopic();
      fetchPosts();
    }
  }, [isApproved, id]);

  const fetchTopic = async () => {
    const { data } = await supabase
      .from('forum_topics')
      .select(`
        *,
        profiles!created_by(full_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    setTopic(data as any);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('forum_posts')
      .select(`
        *,
        profiles!created_by(full_name, avatar_url)
      `)
      .eq('topic_id', id)
      .order('created_at', { ascending: true });

    setPosts(data as any || []);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('forum_posts')
        .insert({
          content: newPost,
          topic_id: id,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Resposta enviada',
        description: 'Sua resposta foi adicionada ao tópico',
      });

      setNewPost('');
      fetchPosts();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post deletado',
        description: 'O post foi removido com sucesso',
      });

      fetchPosts();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isApproved || !topic) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Tópico não encontrado</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/forum')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao fórum
        </Button>

        <Card>
          <CardHeader>
            <div className="space-y-4">
              <CardTitle className="text-3xl">{topic.title}</CardTitle>
              {topic.description && (
                <p className="text-muted-foreground">{topic.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={topic.profiles?.avatar_url} />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span>{topic.profiles?.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {formatDistanceToNow(new Date(topic.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Respostas ({posts.length})</h2>
          
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback>
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{post.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                  </div>
                  {(isAdmin || post.created_by === profile?.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePost(post.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="py-6">
              <form onSubmit={handleCreatePost} className="space-y-4">
                <Textarea
                  placeholder="Escreva sua resposta..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  required
                  disabled={submitting}
                  rows={4}
                />
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar Resposta'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
