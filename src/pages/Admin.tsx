import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Shield, UserPlus, History, Lightbulb, MessageSquare, ThumbsUp, ChevronDown, ChevronUp, Filter, Users, CalendarCheck, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { SuggestionComments } from '@/components/SuggestionComments';
import { SuggestionTagManager } from '@/components/SuggestionTagManager';
import { AdminPermissionsManager } from '@/components/AdminPermissionsManager';
import { useNavigate } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  avatar_url: string | null;
  position: string | null;
}

interface ApprovedUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  join_date: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

interface UsageHistoryItem {
  id: string;
  user_id: string;
  tool_name: string;
  action: string;
  metadata: any;
  created_at: string;
  profiles: {
    email: string;
    full_name: string;
  };
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  user_id: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
}

export default function Admin() {
  const { isAdmin, loading } = useUserRole();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [openSuggestions, setOpenSuggestions] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingJoinDate, setEditingJoinDate] = useState<Date | undefined>(undefined);
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSocioOrRafael } = useAdminPermissions();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingUsers();
      fetchApprovedUsers();
      fetchAdminUsers();
      fetchUsageHistory();
      fetchSuggestions();
      fetchTags();
    }
  }, [isAdmin, filterStatus, filterCategory, searchQuery, sortBy, selectedTags]);

  const fetchPendingUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, avatar_url, position')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    setPendingUsers(data || []);
  };

  const fetchApprovedUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, position, join_date')
      .eq('approval_status', 'approved')
      .order('full_name');
    setApprovedUsers(data || []);
  };

  const handleUpdateJoinDate = async (userId: string, joinDate: Date | undefined) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        join_date: joinDate ? format(joinDate, 'yyyy-MM-dd') : null,
      })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar data de ingresso',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado',
        description: 'Data de ingresso atualizada com sucesso',
      });
      fetchApprovedUsers();
      setEditingUserId(null);
      setEditingJoinDate(undefined);
    }
  };

  const filteredApprovedUsers = approvedUsers.filter(user => 
    user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const fetchAdminUsers = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        profiles (
          id,
          email,
          full_name,
          avatar_url,
          position
        )
      `)
      .eq('role', 'admin');

    const admins = data?.map((item: any) => ({
      id: item.profiles.id,
      email: item.profiles.email,
      full_name: item.profiles.full_name,
      avatar_url: item.profiles.avatar_url,
      position: item.profiles.position,
    })) || [];
    
    setAdminUsers(admins);
  };

  const fetchUsageHistory = async () => {
    const { data: historyData } = await supabase
      .from('usage_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!historyData) {
      setUsageHistory([]);
      return;
    }

    // Buscar perfis dos usuários
    const userIds = [...new Set(historyData.map(item => item.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    const enrichedHistory = historyData.map(item => ({
      ...item,
      profiles: profilesMap.get(item.user_id) || { email: 'Desconhecido', full_name: 'Desconhecido' }
    }));
    
    setUsageHistory(enrichedHistory);
  };

  const fetchTags = async () => {
    const { data } = await supabase
      .from('suggestion_tags')
      .select('*')
      .order('name');
    
    setAllTags(data || []);
  };

  const handleApprove = async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userData?.user?.id,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao aprovar:', error);
      toast({
        title: 'Erro',
        description: error?.message || 'Erro ao aprovar usuário. Verifique suas permissões.',
        variant: 'destructive',
      });
      // Recarregar em caso de erro
      fetchPendingUsers();
    } else {
      toast({
        title: 'Usuário aprovado',
        description: 'O usuário já pode acessar o sistema',
      });
      // Remover da lista de pendentes e atualizar aprovados
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      fetchApprovedUsers();
    }
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'rejected',
      })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar usuário',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuário rejeitado',
        description: 'O acesso foi negado',
      });
      fetchPendingUsers();
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin',
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao promover usuário a admin',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Admin adicionado',
        description: 'Usuário agora tem privilégios de administrador',
      });
      fetchAdminUsers();
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) {
        // Verificar se é o erro de proteção do Rafael
        if (error.message.includes('criador da intranet')) {
          toast({
            title: 'Operação não permitida',
            description: 'Rafael Egg Nunes não pode ter seus privilégios removidos',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Admin removido',
          description: 'Privilégios de administrador removidos',
        });
        fetchAdminUsers();
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchSuggestions = async () => {
    let query = supabase
      .from('suggestions')
      .select('*');

    if (filterStatus !== "all") {
      query = query.eq('status', filterStatus);
    }

    if (filterCategory !== "all") {
      query = query.eq('category', filterCategory);
    }

    const { data: suggestionsData } = await query;

    if (!suggestionsData) {
      setSuggestions([]);
      return;
    }

    // Buscar perfis dos usuários
    const userIds = [...new Set(suggestionsData.map(item => item.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Buscar contagem de votos
    const suggestionIds = suggestionsData.map(s => s.id);
    const { data: votesData } = await supabase
      .from('suggestion_votes')
      .select('suggestion_id')
      .in('suggestion_id', suggestionIds);

    const votesCount = votesData?.reduce((acc, vote) => {
      acc[vote.suggestion_id] = (acc[vote.suggestion_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Buscar contagem de comentários
    const { data: commentsData } = await supabase
      .from('suggestion_comments')
      .select('suggestion_id')
      .in('suggestion_id', suggestionIds);

    const commentsCount = commentsData?.reduce((acc, comment) => {
      acc[comment.suggestion_id] = (acc[comment.suggestion_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    let enrichedSuggestions = suggestionsData.map(item => ({
      ...item,
      profiles: profilesMap.get(item.user_id) || { email: 'Desconhecido', full_name: 'Desconhecido' },
      votes: votesCount[item.id] || 0,
      comments: commentsCount[item.id] || 0,
    }));

    // Filtrar por tags se houver tags selecionadas
    if (selectedTags.length > 0) {
      const { data: tagRelations } = await supabase
        .from('suggestion_tag_relations')
        .select('suggestion_id, tag_id')
        .in('suggestion_id', suggestionIds);

      // Agrupar tags por sugestão
      const suggestionTagsMap = tagRelations?.reduce((acc, rel) => {
        if (!acc[rel.suggestion_id]) {
          acc[rel.suggestion_id] = [];
        }
        acc[rel.suggestion_id].push(rel.tag_id);
        return acc;
      }, {} as Record<string, string[]>) || {};

      // Filtrar sugestões que têm TODAS as tags selecionadas
      enrichedSuggestions = enrichedSuggestions.filter((s: any) => {
        const suggestionTags = suggestionTagsMap[s.id] || [];
        return selectedTags.every((tagId) => suggestionTags.includes(tagId));
      });
    }

    // Aplicar busca local
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      enrichedSuggestions = enrichedSuggestions.filter(
        (s: any) =>
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
    }

    // Aplicar ordenação
    switch (sortBy) {
      case "newest":
        enrichedSuggestions.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        enrichedSuggestions.sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "most_voted":
        enrichedSuggestions.sort((a: any, b: any) => b.votes - a.votes);
        break;
      case "most_commented":
        enrichedSuggestions.sort((a: any, b: any) => b.comments - a.comments);
        break;
      case "relevance":
        enrichedSuggestions.sort((a: any, b: any) => {
          const scoreA = a.votes * 2 + a.comments;
          const scoreB = b.votes * 2 + b.comments;
          return scoreB - scoreA;
        });
        break;
    }
    
    setSuggestions(enrichedSuggestions);
  };

  const handleUpdateSuggestionStatus = async (suggestionId: string, newStatus: string) => {
    const { error } = await supabase
      .from('suggestions')
      .update({ status: newStatus })
      .eq('id', suggestionId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status da sugestão',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Status atualizado',
        description: 'O status da sugestão foi atualizado com sucesso',
      });
      fetchSuggestions();
    }
  };

  const toggleSuggestion = (id: string) => {
    setOpenSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  const categories = {
    melhoria: 'Melhoria de Ferramenta',
    nova_ferramenta: 'Nova Ferramenta',
    bug: 'Reportar Problema',
    geral: 'Sugestão Geral',
  };

  const statusOptions = [
    { value: 'pending', label: 'Pendente' },
    { value: 'em_analise', label: 'Em Análise' },
    { value: 'concluida', label: 'Concluída' },
    { value: 'rejeitada', label: 'Rejeitada' },
  ];

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'em_analise':
        return 'default';
      case 'concluida':
        return 'default';
      case 'rejeitada':
        return 'destructive';
      default:
        return 'secondary';
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

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground text-lg">
            Gerenciamento de usuários e histórico de uso
          </p>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className={`grid w-full ${isSocioOrRafael ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <TabsTrigger value="pending" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Aprovações
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              Sugestões
              {suggestions.filter(s => s.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {suggestions.filter(s => s.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="w-4 h-4" />
              Administradores
            </TabsTrigger>
            {isSocioOrRafael && (
              <TabsTrigger value="permissions" className="gap-2">
                <Lock className="w-4 h-4" />
                Permissões
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Pendentes de Aprovação</CardTitle>
                <CardDescription>
                  Revise e aprove ou rejeite novos cadastros
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário pendente de aprovação
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="h-12 w-12 border-2 border-primary/20">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.position && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {user.position === 'socio' && 'Sócio'}
                                {user.position === 'advogado' && 'Advogado'}
                                {user.position === 'estagiario' && 'Estagiário'}
                                {user.position === 'comercial' && 'Comercial'}
                                {user.position === 'administrativo' && 'Administrativo'}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Solicitado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(user.id)}
                            className="gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(user.id)}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gerenciar Usuários
                </CardTitle>
                <CardDescription>
                  Edite a data de ingresso dos colaboradores
                </CardDescription>
                <div className="pt-4">
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredApprovedUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredApprovedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="h-12 w-12 border-2 border-primary/20">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.position && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {user.position === 'socio' && 'Sócio'}
                                {user.position === 'advogado' && 'Advogado'}
                                {user.position === 'estagiario' && 'Estagiário'}
                                {user.position === 'comercial' && 'Comercial'}
                                {user.position === 'administrativo' && 'Administrativo'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-2">
                                    <CalendarCheck className="w-4 h-4" />
                                    {editingJoinDate 
                                      ? format(editingJoinDate, 'dd/MM/yyyy', { locale: ptBR })
                                      : 'Selecionar'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar
                                    mode="single"
                                    selected={editingJoinDate}
                                    onSelect={setEditingJoinDate}
                                    initialFocus
                                    disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                                    locale={ptBR}
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateJoinDate(user.id, editingJoinDate)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingUserId(null);
                                  setEditingJoinDate(undefined);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="text-sm text-right">
                                <span className="text-muted-foreground">Ingresso: </span>
                                <span className="font-medium">
                                  {user.join_date 
                                    ? format(parse(user.join_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR })
                                    : 'Não informado'}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditingJoinDate(user.join_date 
                                    ? parse(user.join_date, 'yyyy-MM-dd', new Date()) 
                                    : undefined);
                                }}
                              >
                                Editar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggestions">
            <Card>
              <CardHeader>
                <CardTitle>Sugestões dos Usuários</CardTitle>
                <CardDescription>
                  Gerencie as sugestões e atualize seus status
                </CardDescription>
                
                {/* Busca */}
                <div className="pt-4">
                  <Input
                    placeholder="Buscar sugestões por título ou descrição..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Filtros e Ordenação */}
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {Object.entries(categories).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-popover z-50">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">Filtrar por tags</h4>
                          {selectedTags.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearTags}
                              className="h-auto p-1"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {allTags && allTags.length > 0 ? (
                            allTags.map((tag) => (
                              <div key={tag.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`admin-tag-${tag.id}`}
                                  checked={selectedTags.includes(tag.id)}
                                  onCheckedChange={() => toggleTag(tag.id)}
                                />
                                <label
                                  htmlFor={`admin-tag-${tag.id}`}
                                  className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span>{tag.name}</span>
                                </label>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Nenhuma tag disponível
                            </p>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Mais recentes</SelectItem>
                      <SelectItem value="oldest">Mais antigas</SelectItem>
                      <SelectItem value="most_voted">Mais votadas</SelectItem>
                      <SelectItem value="most_commented">Mais comentadas</SelectItem>
                      <SelectItem value="relevance">Relevância</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {suggestions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma sugestão encontrada
                  </p>
                ) : (
                  <div className="space-y-4">
                    {suggestions.map((suggestion: any) => (
                      <Collapsible
                        key={suggestion.id}
                        open={openSuggestions.has(suggestion.id)}
                        onOpenChange={() => toggleSuggestion(suggestion.id)}
                      >
                        <div className="p-4 border border-border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{suggestion.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {suggestion.description}
                              </p>
                            </div>
                            <Badge variant={statusBadgeVariant(suggestion.status)}>
                              {statusOptions.find(s => s.value === suggestion.status)?.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {categories[suggestion.category as keyof typeof categories] || suggestion.category}
                            </span>
                            <span>•</span>
                            <span>{suggestion.profiles?.full_name}</span>
                            <span>•</span>
                            <span>{new Date(suggestion.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>

                          <SuggestionTagManager
                            suggestionId={suggestion.id}
                            isAdmin={true}
                          />

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{suggestion.votes}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <MessageSquare className="h-4 w-4" />
                              <span>{suggestion.comments}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Status:</span>
                              <Select
                                value={suggestion.status}
                                onValueChange={(value) => handleUpdateSuggestionStatus(suggestion.id, value)}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {openSuggestions.has(suggestion.id) ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-2" />
                                    Ocultar comentários
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                    Ver comentários
                                  </>
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>

                          <CollapsibleContent className="pt-4 border-t">
                            <SuggestionComments suggestionId={suggestion.id} isAdmin={true} />
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <CardTitle>Administradores do Sistema</CardTitle>
                <CardDescription>
                  Gerencie os usuários com privilégios administrativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminUsers.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-primary/20">
                          <AvatarImage src={admin.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {admin.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{admin.full_name}</p>
                            <p className="text-sm text-muted-foreground">{admin.email}</p>
                            {admin.position && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {admin.position === 'socio' && 'Sócio'}
                                {admin.position === 'advogado' && 'Advogado'}
                                {admin.position === 'estagiario' && 'Estagiário'}
                                {admin.position === 'comercial' && 'Comercial'}
                                {admin.position === 'administrativo' && 'Administrativo'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveAdmin(admin.id)}
                      >
                        Remover Admin
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Uso Geral</CardTitle>
                <CardDescription>
                  Acompanhe o uso das ferramentas por todos os usuários
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usageHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum histórico de uso registrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {usageHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.profiles.full_name}</p>
                            <p className="text-sm text-muted-foreground">{item.profiles.email}</p>
                          </div>
                          <Badge variant="outline">{item.tool_name}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {item.action}
                        </p>
                        {item.metadata && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.metadata.fileCount && `${item.metadata.fileCount} arquivos`}
                            {item.metadata.documentCount && ` → ${item.metadata.documentCount} documentos`}
                            {item.metadata.processingTime && ` (${item.metadata.processingTime}s)`}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab - Only for Sócios and Rafael */}
          {isSocioOrRafael && (
            <TabsContent value="permissions">
              <AdminPermissionsManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
