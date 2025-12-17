import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Check, X, Shield, UserPlus, History, Lightbulb, MessageSquare, MessageSquareHeart, ThumbsUp, ChevronDown, ChevronUp, Filter, Users, CalendarCheck, Lock, Pencil, Key, UserX, UserCheck, Circle } from 'lucide-react';

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
import { FeedbackBoxAdmin } from '@/components/FeedbackBoxAdmin';
import { useNavigate } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  birth_date: string | null;
  oab_number: string | null;
  oab_state: string | null;
  is_active: boolean;
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
  const { isUserOnline, onlineCount } = usePresence();
  const { user } = useAuth();
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
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUserData, setEditingUserData] = useState<{
    id: string;
    full_name: string;
    email: string;
    position: string | null;
    birth_date: string | null;
    join_date: string | null;
    oab_number: string | null;
    oab_state: string | null;
    is_active: boolean;
    is_admin: boolean;
  } | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; email: string; full_name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [isRafael, setIsRafael] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSocioOrRafael } = useAdminPermissions();

  // Check if current user is Rafael
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

  const BRAZILIAN_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ];

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
      .select('id, email, full_name, avatar_url, position, join_date, birth_date, oab_number, oab_state, is_active')
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

  const filteredApprovedUsers = approvedUsers.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesStatus = userStatusFilter === 'all' || 
      (userStatusFilter === 'active' && user.is_active) ||
      (userStatusFilter === 'inactive' && !user.is_active);
    return matchesSearch && matchesStatus;
  });

  const handleOpenEditUser = (user: ApprovedUser) => {
    setEditingUserData({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      position: user.position,
      birth_date: user.birth_date,
      join_date: user.join_date,
      oab_number: user.oab_number,
      oab_state: user.oab_state,
      is_active: user.is_active,
      is_admin: adminUsers.some(a => a.id === user.id),
    });
    setEditUserDialogOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUserData) return;

    const updateData: any = {
      full_name: editingUserData.full_name,
      birth_date: editingUserData.birth_date || null,
      join_date: editingUserData.join_date || null,
      oab_number: editingUserData.oab_number || null,
      oab_state: editingUserData.oab_state || null,
    };

    if (editingUserData.position) {
      updateData.position = editingUserData.position;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', editingUserData.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar dados do usuário',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Atualizado',
        description: 'Dados do usuário atualizados com sucesso',
      });
      fetchApprovedUsers();
      setEditUserDialogOpen(false);
      setEditingUserData(null);
    }
  };

  const handleOpenResetPassword = (user: ApprovedUser) => {
    setResetPasswordUser({ id: user.id, email: user.email, full_name: user.full_name });
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;

    if (newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: resetPasswordUser.id, newPassword }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Erro',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `Senha de ${resetPasswordUser.full_name} redefinida com sucesso`,
        });
        setResetPasswordDialogOpen(false);
        setResetPasswordUser(null);
        setNewPassword('');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao redefinir senha',
        variant: 'destructive',
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleUserActive = async (user: ApprovedUser) => {
    // Prevent deactivating Rafael
    if (user.email === 'rafael@eggnunes.com.br') {
      toast({
        title: 'Operação não permitida',
        description: 'O criador da intranet não pode ser inativado',
        variant: 'destructive',
      });
      return;
    }

    const newActiveStatus = !user.is_active;
    
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newActiveStatus })
      .eq('id', user.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do usuário',
        variant: 'destructive',
      });
    } else {
      toast({
        title: newActiveStatus ? 'Usuário Reativado' : 'Usuário Inativado',
        description: newActiveStatus 
          ? `${user.full_name} agora pode acessar o sistema novamente`
          : `${user.full_name} não poderá mais acessar o sistema`,
      });
      fetchApprovedUsers();
    }
  };

  const fetchAdminUsers = async () => {
    // First fetch admin user_ids from user_roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!rolesData || rolesData.length === 0) {
      setAdminUsers([]);
      return;
    }

    const adminUserIds = rolesData.map(r => r.user_id);

    // Then fetch profiles for those users
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, position')
      .in('id', adminUserIds);

    const admins = profilesData?.map((profile) => ({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      position: profile.position,
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
          <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide touch-pan-x">
            <TabsList className="inline-flex w-max gap-1 h-auto flex-nowrap">
              <TabsTrigger value="pending" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Aprovações</span>
                <span className="sm:hidden">Aprov.</span>
                {pendingUsers.length > 0 && (
                  <Badge variant="destructive" className="ml-0.5 text-[10px] px-1.5">{pendingUsers.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Usuários</span>
                <span className="sm:hidden">Users</span>
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Sugestões</span>
                <span className="sm:hidden">Sug.</span>
                {suggestions.filter(s => s.status === 'pending').length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5">
                    {suggestions.filter(s => s.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Administradores</span>
                <span className="sm:hidden">Admin</span>
              </TabsTrigger>
              {isSocioOrRafael && (
                <TabsTrigger value="permissions" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Permissões</span>
                  <span className="sm:hidden">Perm.</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Histórico Geral</span>
                <span className="sm:hidden">Hist.</span>
              </TabsTrigger>
              {isRafael && (
                <TabsTrigger value="desabafo" className="gap-1.5 flex-shrink-0 px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                  <MessageSquareHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Desabafo</span>
                  <span className="sm:hidden">Desab.</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

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
                  {onlineCount > 0 && (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                      {onlineCount} online
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Gerencie os perfis dos colaboradores
                </CardDescription>
                <div className="pt-4 flex gap-4 flex-wrap">
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredApprovedUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  <TooltipProvider>
                    <div className="space-y-3">
                      {filteredApprovedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="relative">
                              <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {isUserOnline(user.id) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Online agora</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{user.full_name}</p>
                                {isUserOnline(user.id) && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online</span>
                                )}
                              </div>
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
                          {/* Inactive badge */}
                          {!user.is_active && (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="w-3 h-3" />
                              Inativo
                            </Badge>
                          )}
                          {/* Admin badge */}
                          {adminUsers.some(a => a.id === user.id) && (
                            <Badge variant="default" className="gap-1">
                              <Shield className="w-3 h-3" />
                              Admin
                            </Badge>
                          )}
                          
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
                                onClick={() => handleOpenEditUser(user)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Editar Perfil
                              </Button>
                          </div>
                        </div>
                      </div>
                      ))}
                    </div>
                  </TooltipProvider>
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

          {/* Desabafo Tab - Only for Rafael */}
          {isRafael && (
            <TabsContent value="desabafo">
              <FeedbackBoxAdmin />
            </TabsContent>
          )}
        </Tabs>

        {/* Dialog de Edição de Usuário */}
        <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do colaborador
              </DialogDescription>
            </DialogHeader>
            {editingUserData && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome Completo</Label>
                  <Input
                    id="edit-name"
                    value={editingUserData.full_name}
                    onChange={(e) => setEditingUserData({ ...editingUserData, full_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    value={editingUserData.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-position">Cargo</Label>
                  <Select
                    value={editingUserData.position || ''}
                    onValueChange={(value) => setEditingUserData({ ...editingUserData, position: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socio">Sócio</SelectItem>
                      <SelectItem value="advogado">Advogado</SelectItem>
                      <SelectItem value="estagiario">Estagiário</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="administrativo">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-birth-date">Data de Nascimento</Label>
                    <Input
                      id="edit-birth-date"
                      type="date"
                      value={editingUserData.birth_date || ''}
                      onChange={(e) => setEditingUserData({ ...editingUserData, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-join-date">Data de Ingresso</Label>
                    <Input
                      id="edit-join-date"
                      type="date"
                      value={editingUserData.join_date || ''}
                      onChange={(e) => setEditingUserData({ ...editingUserData, join_date: e.target.value })}
                    />
                  </div>
                </div>

                {(editingUserData.position === 'advogado' || editingUserData.position === 'estagiario' || editingUserData.position === 'socio') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-oab-number">Número OAB</Label>
                      <Input
                        id="edit-oab-number"
                        value={editingUserData.oab_number || ''}
                        onChange={(e) => setEditingUserData({ ...editingUserData, oab_number: e.target.value })}
                        placeholder="Ex: 123456"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-oab-state">Estado OAB</Label>
                      <Select
                        value={editingUserData.oab_state || ''}
                        onValueChange={(value) => setEditingUserData({ ...editingUserData, oab_state: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Ações Administrativas */}
                <div className="border-t pt-4 mt-4 space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">Ações Administrativas</Label>
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Redefinir Senha */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditUserDialogOpen(false);
                        setResetPasswordUser({ 
                          id: editingUserData.id, 
                          email: editingUserData.email, 
                          full_name: editingUserData.full_name 
                        });
                        setNewPassword('');
                        setResetPasswordDialogOpen(true);
                      }}
                    >
                      <Key className="w-4 h-4 mr-1" />
                      Redefinir Senha
                    </Button>

                    {/* Tornar/Remover Admin - Apenas Sócios */}
                    {isSocioOrRafael && editingUserData.email !== 'rafael@eggnunes.com.br' && (
                      editingUserData.is_admin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await handleRemoveAdmin(editingUserData.id);
                            setEditingUserData({ ...editingUserData, is_admin: false });
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Remover Admin
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={async () => {
                            await handleMakeAdmin(editingUserData.id);
                            setEditingUserData({ ...editingUserData, is_admin: true });
                          }}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Tornar Admin
                        </Button>
                      )
                    )}

                    {/* Inativar/Reativar */}
                    {editingUserData.email !== 'rafael@eggnunes.com.br' && (
                      <Button
                        type="button"
                        size="sm"
                        variant={editingUserData.is_active ? 'outline' : 'default'}
                        onClick={async () => {
                          const user = approvedUsers.find(u => u.id === editingUserData.id);
                          if (user) {
                            await handleToggleUserActive(user);
                            setEditingUserData({ ...editingUserData, is_active: !editingUserData.is_active });
                          }
                        }}
                        className={editingUserData.is_active ? 'text-destructive hover:text-destructive' : ''}
                      >
                        {editingUserData.is_active ? (
                          <>
                            <UserX className="w-4 h-4 mr-1" />
                            Inativar
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            Reativar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUserEdit}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Redefinição de Senha */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redefinir Senha</DialogTitle>
              <DialogDescription>
                {resetPasswordUser && (
                  <>Definir nova senha para <strong>{resetPasswordUser.full_name}</strong> ({resetPasswordUser.email})</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)} disabled={resettingPassword}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={resettingPassword || !newPassword || newPassword.length < 6}>
                {resettingPassword ? 'Redefinindo...' : 'Redefinir Senha'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
