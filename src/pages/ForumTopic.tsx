import { useEffect, useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Clock, Trash2, AtSign } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
}

export default function ForumTopic() {
  const { id } = useParams();
  const { isApproved, loading, isAdmin, profile } = useUserRole();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isApproved && id) {
      fetchTopic();
      fetchPosts();
      fetchUsers();
    }
  }, [isApproved, id]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('approval_status', 'approved');
    
    if (data) setAllUsers(data as UserProfile[]);
  };

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    
    setNewPost(value);
    setCursorPosition(position);

    // Detectar @ para mencionar
    const lastAtIndex = value.lastIndexOf('@', position);
    if (lastAtIndex !== -1 && lastAtIndex === position - 1) {
      setShowMentionPopover(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1 && position > lastAtIndex) {
      const searchText = value.substring(lastAtIndex + 1, position);
      if (!searchText.includes(' ')) {
        setMentionSearch(searchText);
        setShowMentionPopover(true);
      } else {
        setShowMentionPopover(false);
      }
    } else {
      setShowMentionPopover(false);
    }
  };

  const handleMentionSelect = (user: UserProfile) => {
    const lastAtIndex = newPost.lastIndexOf('@', cursorPosition);
    const beforeMention = newPost.substring(0, lastAtIndex);
    const afterMention = newPost.substring(cursorPosition);
    const newValue = `${beforeMention}@${user.full_name} ${afterMention}`;
    
    setNewPost(newValue);
    setShowMentionPopover(false);
    textareaRef.current?.focus();
  };

  const filteredUsers = allUsers.filter(user =>
    user.full_name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const extractMentions = (content: string): string[] => {
    const mentionRegex = /@([^\s]+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  };

  const createNotifications = async (postId: string, mentions: string[]) => {
    for (const mentionedName of mentions) {
      const mentionedUser = allUsers.find(u => u.full_name === mentionedName);
      if (mentionedUser && mentionedUser.id !== profile?.id) {
        await supabase.from('forum_notifications').insert({
          user_id: mentionedUser.id,
          post_id: postId,
          mentioned_by: profile?.id,
        });
      }
    }
  };

  const highlightMentions = (content: string) => {
    const parts = content.split(/(@[^\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-primary font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: newPostData, error } = await supabase
        .from('forum_posts')
        .insert({
          content: newPost,
          topic_id: id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Criar notificações para menções
      const mentions = extractMentions(newPost);
      if (mentions.length > 0 && newPostData) {
        await createNotifications(newPostData.id, mentions);
      }

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
                    <p className="text-foreground whitespace-pre-wrap">
                      {highlightMentions(post.content)}
                    </p>
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
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Escreva sua resposta... (Use @ para mencionar alguém)"
                    value={newPost}
                    onChange={handleTextareaChange}
                    required
                    disabled={submitting}
                    rows={4}
                  />
                  <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          const pos = textareaRef.current?.selectionStart || 0;
                          setNewPost(newPost.slice(0, pos) + '@' + newPost.slice(pos));
                          setShowMentionPopover(true);
                          setMentionSearch('');
                        }}
                      >
                        <AtSign className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2">
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-2">
                            Nenhum usuário encontrado
                          </p>
                        ) : (
                          filteredUsers.map((user) => (
                            <Button
                              key={user.id}
                              variant="ghost"
                              className="w-full justify-start gap-2"
                              onClick={() => handleMentionSelect(user)}
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback>
                                  <User className="w-3 h-3" />
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{user.full_name}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
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
