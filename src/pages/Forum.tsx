import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, Search, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Topic {
  id: string;
  title: string;
  description: string;
  created_at: string;
  last_post_at: string;
  created_by: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  post_count: number;
}

export default function Forum() {
  const { isApproved, loading } = useUserRole();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isApproved) {
      fetchTopics();
    }
  }, [isApproved, searchQuery]);

  const fetchTopics = async () => {
    let query = supabase
      .from('forum_topics')
      .select(`
        *,
        profiles!created_by(full_name, avatar_url)
      `);

    const { data: topicsData } = await query.order('last_post_at', { ascending: false });

    if (!topicsData) {
      setTopics([]);
      return;
    }

    // Buscar contagem de posts para cada tópico
    const topicIds = topicsData.map(t => t.id);
    const { data: postsData } = await supabase
      .from('forum_posts')
      .select('topic_id')
      .in('topic_id', topicIds);

    const postsCount = postsData?.reduce((acc, post) => {
      acc[post.topic_id] = (acc[post.topic_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    let enrichedTopics = topicsData.map(topic => ({
      ...topic,
      post_count: postsCount[topic.id] || 0,
    })) as any;

    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      enrichedTopics = enrichedTopics.filter(
        (t: any) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    setTopics(enrichedTopics);
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('forum_topics')
        .insert({
          title: newTitle,
          description: newDescription,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Tópico criado',
        description: 'Seu tópico foi criado com sucesso',
      });

      setNewTitle('');
      setNewDescription('');
      setShowNewTopic(false);
      fetchTopics();
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isApproved) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Acesso negado</CardTitle>
              <CardDescription>
                Você precisa de aprovação para acessar o fórum
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Fórum de Discussão</h1>
            <p className="text-muted-foreground text-lg">
              Participe das conversas e compartilhe ideias com a equipe
            </p>
          </div>
          <Button onClick={() => setShowNewTopic(!showNewTopic)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Tópico
          </Button>
        </div>

        {showNewTopic && (
          <Card>
            <CardHeader>
              <CardTitle>Criar Novo Tópico</CardTitle>
              <CardDescription>Inicie uma nova discussão no fórum</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTopic} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Título do tópico"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Descrição (opcional)"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    disabled={submitting}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Criando...' : 'Criar Tópico'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewTopic(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar tópicos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-4">
          {topics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'Nenhum tópico encontrado' : 'Nenhum tópico criado ainda'}
                </p>
              </CardContent>
            </Card>
          ) : (
            topics.map((topic) => (
              <Card
                key={topic.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/forum/${topic.id}`)}
              >
                <CardContent className="py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {topic.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {topic.profiles?.avatar_url ? (
                            <img
                              src={topic.profiles.avatar_url}
                              alt={topic.profiles.full_name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                          <span>{topic.profiles?.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <span>{topic.post_count} {topic.post_count === 1 ? 'resposta' : 'respostas'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {formatDistanceToNow(new Date(topic.last_post_at || topic.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
