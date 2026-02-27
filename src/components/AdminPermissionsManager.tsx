import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Save, Users, Eye, Edit3, Ban, Search, User, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  position: string | null;
}

interface AdminPermissionRecord {
  id: string;
  admin_user_id: string;
  perm_financial: string;
  perm_users: string;
  perm_announcements: string;
  perm_suggestions: string;
  perm_forum: string;
  perm_documents: string;
  perm_onboarding: string;
  perm_events: string;
  perm_home_office: string;
  perm_vacation: string;
  perm_birthdays: string;
  perm_copa_cozinha: string;
  perm_advbox: string;
  perm_collection: string;
  perm_admin_requests: string;
  perm_task_rules: string;
  perm_recruitment: string;
  perm_lead_tracking: string;
  perm_totp: string;
  perm_teams: string;
}

interface GroupPermission {
  id: string;
  position: string;
  is_admin_group: boolean;
  perm_financial: string;
  perm_users: string;
  perm_announcements: string;
  perm_suggestions: string;
  perm_forum: string;
  perm_documents: string;
  perm_onboarding: string;
  perm_events: string;
  perm_home_office: string;
  perm_vacation: string;
  perm_birthdays: string;
  perm_copa_cozinha: string;
  perm_advbox: string;
  perm_collection: string;
  perm_admin_requests: string;
  perm_task_rules: string;
  perm_recruitment: string;
  perm_lead_tracking: string;
  perm_totp: string;
  perm_teams: string;
}

// Categorias de permissões para melhor organização visual
const PERMISSION_CATEGORIES = [
  {
    category: 'Administrativo',
    features: [
      { key: 'users', label: 'Gestão de Usuários' },
      { key: 'admin_requests', label: 'Solicitações Admin' },
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'integracoes', label: 'Integrações' },
      { key: 'payroll', label: 'Folha de Pagamento (RH)' },
      { key: 'historico_pagamentos', label: 'Histórico de Pagamentos' },
    ]
  },
  {
    category: 'Financeiro',
    features: [
      { key: 'financial', label: 'Relatórios Financeiros' },
      { key: 'collection', label: 'Cobranças' },
    ]
  },
  {
    category: 'Jurídico',
    features: [
      { key: 'advbox', label: 'Advbox Geral' },
      { key: 'processos', label: 'Dashboard de Processos' },
      { key: 'publicacoes', label: 'Publicações' },
      { key: 'tarefas_advbox', label: 'Tarefas Advbox' },
      { key: 'decisoes', label: 'Jurisprudência Interna' },
      { key: 'contratos', label: 'Gerador de Contratos' },
      { key: 'jurisprudencia', label: 'Pesquisa de Jurisprudência' },
      { key: 'rota_doc', label: 'Rota Doc' },
    ]
  },
  {
    category: 'Comercial',
    features: [
      { key: 'crm', label: 'CRM' },
      { key: 'lead_tracking', label: 'Tracking de Leads' },
      { key: 'setor_comercial', label: 'Setor Comercial' },
      { key: 'utm_generator', label: 'Gerador de UTM' },
      { key: 'aniversarios_clientes', label: 'Aniversários de Clientes' },
      { key: 'parceiros', label: 'Parceiros' },
    ]
  },
  {
    category: 'Inteligência Artificial',
    features: [
      { key: 'assistente_ia', label: 'Assistente IA' },
      { key: 'agentes_ia', label: 'Agentes IA' },
    ]
  },
  {
    category: 'Comunicação',
    features: [
      { key: 'announcements', label: 'Mural de Avisos' },
      { key: 'forum', label: 'Fórum' },
      { key: 'suggestions', label: 'Sugestões' },
      { key: 'mensagens', label: 'Mensagens/Chat' },
      { key: 'caixinha_desabafo', label: 'Caixinha de Desabafo' },
    ]
  },
  {
    category: 'Equipe e RH',
    features: [
      { key: 'vacation', label: 'Férias' },
      { key: 'home_office', label: 'Home Office' },
      { key: 'birthdays', label: 'Aniversários da Equipe' },
      { key: 'recruitment', label: 'Contratação' },
      { key: 'task_rules', label: 'Regras de Tarefas' },
    ]
  },
  {
    category: 'Recursos e Espaços',
    features: [
      { key: 'documents', label: 'Documentos Úteis' },
      { key: 'events', label: 'Galeria de Eventos' },
      { key: 'copa_cozinha', label: 'Copa/Cozinha' },
      { key: 'sala_reuniao', label: 'Sala de Reunião' },
      { key: 'sobre_escritorio', label: 'Sobre o Escritório' },
    ]
  },
  {
    category: 'Ferramentas',
    features: [
      { key: 'totp', label: 'Códigos TOTP' },
      { key: 'teams', label: 'Microsoft Teams' },
      { key: 'arquivos_teams', label: 'Arquivos Teams' },
    ]
  },
];

// Lista plana para compatibilidade
const PERMISSION_FEATURES = PERMISSION_CATEGORIES.flatMap(cat => cat.features);

const PERMISSION_LEVELS = [
  { value: 'none', label: 'Sem Acesso', icon: Ban, color: 'text-destructive' },
  { value: 'view', label: 'Visualizar', icon: Eye, color: 'text-yellow-600' },
  { value: 'edit', label: 'Editar', icon: Edit3, color: 'text-green-600' },
];

const GROUP_LABELS: Record<string, string> = {
  admin: 'Administradores',
  advogado: 'Advogados',
  estagiario: 'Estagiários',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
  user: 'Usuário Padrão',
  socio: 'Sócio',
};

export const AdminPermissionsManager = () => {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Record<string, AdminPermissionRecord>>({});
  const [groupDefaults, setGroupDefaults] = useState<GroupPermission[]>([]);
  const [editingPermissions, setEditingPermissions] = useState<Record<string, Record<string, string>>>({});
  const [editingGroupPermissions, setEditingGroupPermissions] = useState<Record<string, Record<string, string>>>({});
  const [hasOverrides, setHasOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [mainTab, setMainTab] = useState<'groups' | 'individual'>('groups');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchAllUsers(),
      fetchAdminUserIds(),
      fetchPermissions(),
      fetchGroupDefaults(),
    ]);
  };

  const fetchAllUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, position')
      .eq('approval_status', 'approved')
      .neq('position', 'socio')
      .neq('email', 'rafael@eggnunes.com.br')
      .order('full_name');

    setAllUsers(profiles || []);
  };

  const fetchAdminUserIds = async () => {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminRoles) {
      setAdminUserIds(new Set(adminRoles.map(r => r.user_id)));
    }
  };

  const fetchPermissions = async () => {
    const { data } = await supabase.from('admin_permissions').select('*');

    if (data) {
      const permMap: Record<string, AdminPermissionRecord> = {};
      const overridesMap: Record<string, boolean> = {};
      data.forEach(p => {
        permMap[p.admin_user_id] = p;
        overridesMap[p.admin_user_id] = true;
      });
      setPermissions(permMap);
      setHasOverrides(overridesMap);
    }
  };

  const fetchGroupDefaults = async () => {
    const { data } = await supabase
      .from('position_permission_defaults')
      .select('*')
      .order('is_admin_group', { ascending: false });

    if (data) {
      setGroupDefaults(data);
      
      // Initialize editing state for groups
      const editState: Record<string, Record<string, string>> = {};
      data.forEach(g => {
        editState[g.position] = {};
        PERMISSION_FEATURES.forEach(f => {
          const key = `perm_${f.key}` as keyof GroupPermission;
          editState[g.position][f.key] = g[key] as string;
        });
      });
      setEditingGroupPermissions(editState);
    }
  };

  const getUserGroupKey = (userItem: Profile): string => {
    const isAdmin = adminUserIds.has(userItem.id);
    return isAdmin ? 'admin' : (userItem.position || 'user');
  };

  const getGroupPermissionValue = (position: string, feature: string): string => {
    const group = groupDefaults.find(g => g.position === position);
    if (group) {
      const key = `perm_${feature}` as keyof GroupPermission;
      return group[key] as string;
    }
    return 'none';
  };

  const handleGroupPermissionChange = (position: string, feature: string, value: string) => {
    setEditingGroupPermissions(prev => ({
      ...prev,
      [position]: {
        ...(prev[position] || {}),
        [feature]: value
      }
    }));
  };

  const handleSaveGroup = async (position: string) => {
    setSavingGroup(position);

    const permsToSave = editingGroupPermissions[position] || {};
    const permRecord: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      permRecord[`perm_${f.key}`] = permsToSave[f.key] || 'none';
    });

    const { error } = await supabase
      .from('position_permission_defaults')
      .update(permRecord)
      .eq('position', position);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar as permissões do grupo.', variant: 'destructive' });
    } else {
      toast({ title: 'Permissões salvas', description: `Permissões do grupo ${GROUP_LABELS[position] || position} atualizadas.` });
      fetchGroupDefaults();
    }

    setSavingGroup(null);
  };

  const setAllGroupPermissions = (position: string, level: string) => {
    const newPerms: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      newPerms[f.key] = level;
    });
    setEditingGroupPermissions(prev => ({
      ...prev,
      [position]: newPerms
    }));
  };

  const handlePermissionChange = (userId: string, feature: string, value: string) => {
    setEditingPermissions(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [feature]: value
      }
    }));
  };

  const handleMakeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao promover usuário a admin', variant: 'destructive' });
    } else {
      toast({ title: 'Admin adicionado', description: 'Usuário agora tem privilégios de administrador' });
      setAdminUserIds(prev => new Set([...prev, userId]));
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (error) {
      if (error.message.includes('criador da intranet')) {
        toast({ title: 'Operação não permitida', description: 'Rafael Egg Nunes não pode ter seus privilégios removidos', variant: 'destructive' });
      } else {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Admin removido', description: 'Privilégios de administrador removidos' });
      setAdminUserIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getEffectivePermission = (userId: string, userItem: Profile, feature: string): string => {
    if (editingPermissions[userId]?.[feature] !== undefined) {
      return editingPermissions[userId][feature];
    }
    if (permissions[userId]) {
      const key = `perm_${feature}` as keyof AdminPermissionRecord;
      return permissions[userId][key] as string;
    }
    const groupKey = getUserGroupKey(userItem);
    return getGroupPermissionValue(groupKey, feature);
  };

  const handleSave = async (userId: string) => {
    setSaving(userId);

    const userItem = allUsers.find(u => u.id === userId);
    if (!userItem) return;

    const permsToSave = editingPermissions[userId] || {};
    const permRecord: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      permRecord[`perm_${f.key}`] = permsToSave[f.key] || getEffectivePermission(userId, userItem, f.key);
    });

    const existingPerm = permissions[userId];

    try {
      if (existingPerm) {
        const { error } = await supabase
          .from('admin_permissions')
          .update(permRecord)
          .eq('admin_user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_permissions')
          .insert({ admin_user_id: userId, created_by: user?.id, ...permRecord });
        if (error) throw error;
      }

      toast({ title: 'Permissões salvas', description: 'As permissões individuais foram atualizadas.' });
      fetchPermissions();
      setEditingPermissions(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleResetToGroup = async (userId: string) => {
    const { error } = await supabase
      .from('admin_permissions')
      .delete()
      .eq('admin_user_id', userId);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível resetar permissões.', variant: 'destructive' });
    } else {
      toast({ title: 'Permissões resetadas', description: 'Usuário agora usa permissões do grupo.' });
      fetchPermissions();
      setEditingPermissions(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    }
  };

  const availableGroups = ['all', 'admin', ...new Set(allUsers.map(u => u.position).filter(Boolean))];

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = searchQuery === '' || 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterGroup === 'all') return matchesSearch;
    if (filterGroup === 'admin') return matchesSearch && adminUserIds.has(u.id);
    return matchesSearch && u.position === filterGroup;
  });

  return (
    <div className="space-y-6">
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="groups" className="gap-2">
            <Users className="h-4 w-4" />
            Permissões por Grupo
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2">
            <User className="h-4 w-4" />
            Permissões Individuais
          </TabsTrigger>
        </TabsList>

        {/* GROUP PERMISSIONS TAB */}
        <TabsContent value="groups" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Permissões por Grupo
              </CardTitle>
              <CardDescription>
                Configure as permissões padrão para cada grupo. Usuários herdam automaticamente as permissões do seu grupo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {groupDefaults.map(group => (
                <Card key={group.id} className="border-muted">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-lg">{GROUP_LABELS[group.position] || group.position}</p>
                            {group.is_admin_group && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="w-3 h-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Permissões padrão para usuários do grupo
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAllGroupPermissions(group.position, 'none')}>
                          Nenhum
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAllGroupPermissions(group.position, 'view')}>
                          Todos Visualizar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAllGroupPermissions(group.position, 'edit')}>
                          Todos Editar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {PERMISSION_CATEGORIES.map(category => (
                        <div key={category.category}>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">{category.category}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {category.features.map(feature => {
                              const currentValue = editingGroupPermissions[group.position]?.[feature.key] || 'none';

                              return (
                                <div key={feature.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border">
                                  <div className="flex-1 min-w-0 mr-2">
                                    <p className="text-sm font-medium truncate">{feature.label}</p>
                                  </div>
                                  <Select
                                    value={currentValue}
                                    onValueChange={(value) => handleGroupPermissionChange(group.position, feature.key, value)}
                                  >
                                    <SelectTrigger className="w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PERMISSION_LEVELS.map(level => {
                                        const Icon = level.icon;
                                        return (
                                          <SelectItem key={level.value} value={level.value}>
                                            <div className="flex items-center gap-2">
                                              <Icon className={`h-4 w-4 ${level.color}`} />
                                              <span>{level.label}</span>
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => handleSaveGroup(group.position)} disabled={savingGroup === group.position}>
                        <Save className="h-4 w-4 mr-2" />
                        {savingGroup === group.position ? 'Salvando...' : 'Salvar Permissões do Grupo'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INDIVIDUAL PERMISSIONS TAB */}
        <TabsContent value="individual" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Permissões Individuais
              </CardTitle>
              <CardDescription>
                Personalize permissões de usuários específicos. Sobrescreve as permissões do grupo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Grupos</SelectItem>
                    {availableGroups.filter(g => g !== 'all').map(group => (
                      <SelectItem key={group} value={group}>
                        {GROUP_LABELS[group] || group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map(userItem => {
                    const isAdmin = adminUserIds.has(userItem.id);
                    const groupKey = getUserGroupKey(userItem);
                    const hasIndividualOverride = hasOverrides[userItem.id] || !!editingPermissions[userItem.id];

                    return (
                      <Card key={userItem.id} className="border-muted">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={userItem.avatar_url || ''} />
                                <AvatarFallback>{userItem.full_name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{userItem.full_name}</p>
                                  <Badge variant={isAdmin ? "default" : "secondary"}>
                                    {GROUP_LABELS[groupKey] || groupKey}
                                  </Badge>
                                  {hasIndividualOverride && (
                                    <Badge variant="outline" className="text-xs">Personalizado</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{userItem.email}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {isAdmin ? (
                                <Button size="sm" variant="outline" onClick={() => handleRemoveAdmin(userItem.id)} className="gap-2 text-destructive hover:text-destructive">
                                  <User className="h-4 w-4" />
                                  Remover Admin
                                </Button>
                              ) : (
                                <Button size="sm" variant="default" onClick={() => handleMakeAdmin(userItem.id)} className="gap-2">
                                  <Shield className="h-4 w-4" />
                                  Tornar Admin
                                </Button>
                              )}
                              {hasIndividualOverride && (
                                <Button size="sm" variant="outline" onClick={() => handleResetToGroup(userItem.id)} className="gap-2">
                                  <RotateCcw className="h-4 w-4" />
                                  Resetar para Grupo
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {PERMISSION_CATEGORIES.map(category => (
                              <div key={category.category}>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2">{category.category}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {category.features.map(feature => {
                                    const effectiveValue = editingPermissions[userItem.id]?.[feature.key] ?? 
                                      (permissions[userItem.id] ? (permissions[userItem.id] as any)[`perm_${feature.key}`] : null);
                                    const groupValue = getGroupPermissionValue(groupKey, feature.key);
                                    const displayValue = effectiveValue ?? groupValue;
                                    const isOverridden = effectiveValue !== null && effectiveValue !== groupValue;

                                    return (
                                      <div 
                                        key={feature.key} 
                                        className={`flex items-center justify-between p-2 rounded-lg border ${isOverridden ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}
                                      >
                                        <div className="flex-1 min-w-0 mr-2">
                                          <p className="text-sm font-medium truncate">{feature.label}</p>
                                          {!isOverridden && <p className="text-xs text-muted-foreground">Do grupo</p>}
                                        </div>
                                        <Select
                                          value={displayValue}
                                          onValueChange={(value) => handlePermissionChange(userItem.id, feature.key, value)}
                                        >
                                          <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {PERMISSION_LEVELS.map(level => {
                                              const Icon = level.icon;
                                              return (
                                                <SelectItem key={level.value} value={level.value}>
                                                  <div className="flex items-center gap-2">
                                                    <Icon className={`h-4 w-4 ${level.color}`} />
                                                    <span>{level.label}</span>
                                                  </div>
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          {editingPermissions[userItem.id] && (
                            <div className="flex justify-end mt-4">
                              <Button onClick={() => handleSave(userItem.id)} disabled={saving === userItem.id}>
                                <Save className="h-4 w-4 mr-2" />
                                {saving === userItem.id ? 'Salvando...' : 'Salvar Alterações'}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
