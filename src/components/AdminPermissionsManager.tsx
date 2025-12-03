import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Save, Users, Eye, Edit3, Ban, Search, UserCheck, User } from 'lucide-react';
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
}

const PERMISSION_FEATURES = [
  { key: 'financial', label: 'Relatórios Financeiros', description: 'Acesso aos dados financeiros' },
  { key: 'users', label: 'Gestão de Usuários', description: 'Aprovação e gerenciamento de usuários' },
  { key: 'announcements', label: 'Mural de Avisos', description: 'Criação e edição de avisos' },
  { key: 'suggestions', label: 'Sugestões', description: 'Gerenciamento de sugestões' },
  { key: 'forum', label: 'Fórum', description: 'Moderação do fórum' },
  { key: 'documents', label: 'Documentos Úteis', description: 'Gestão de documentos' },
  { key: 'onboarding', label: 'Onboarding', description: 'Materiais de onboarding' },
  { key: 'events', label: 'Galeria de Eventos', description: 'Gestão de eventos' },
  { key: 'home_office', label: 'Home Office', description: 'Escala de home office' },
  { key: 'vacation', label: 'Férias', description: 'Gestão de férias' },
  { key: 'birthdays', label: 'Aniversários', description: 'Gestão de aniversários' },
  { key: 'copa_cozinha', label: 'Copa/Cozinha', description: 'Gestão de alimentos' },
  { key: 'advbox', label: 'Advbox', description: 'Integrações Advbox' },
  { key: 'collection', label: 'Cobranças', description: 'Sistema de cobranças' },
  { key: 'admin_requests', label: 'Solicitações Admin', description: 'Solicitações administrativas' },
  { key: 'task_rules', label: 'Regras de Tarefas', description: 'Regras automáticas de tarefas' },
  { key: 'recruitment', label: 'Contratação', description: 'Gestão de currículos e contratação' },
];

const PERMISSION_LEVELS = [
  { value: 'none', label: 'Sem Acesso', icon: Ban, color: 'text-destructive' },
  { value: 'view', label: 'Visualizar', icon: Eye, color: 'text-yellow-600' },
  { value: 'edit', label: 'Editar', icon: Edit3, color: 'text-green-600' },
];

export const AdminPermissionsManager = () => {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Record<string, AdminPermissionRecord>>({});
  const [editingPermissions, setEditingPermissions] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<'all' | 'admin' | 'user'>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllUsers();
    fetchAdminUserIds();
    fetchPermissions();
  }, []);

  const fetchAllUsers = async () => {
    // Get all approved users except sócios and Rafael
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
    const { data } = await supabase
      .from('admin_permissions')
      .select('*');

    if (data) {
      const permMap: Record<string, AdminPermissionRecord> = {};
      data.forEach(p => {
        permMap[p.admin_user_id] = p;
      });
      setPermissions(permMap);

      // Initialize editing state
      const editState: Record<string, Record<string, string>> = {};
      data.forEach(p => {
        editState[p.admin_user_id] = {};
        PERMISSION_FEATURES.forEach(f => {
          const key = `perm_${f.key}` as keyof AdminPermissionRecord;
          editState[p.admin_user_id][f.key] = p[key] as string;
        });
      });
      setEditingPermissions(editState);
    }
  };

  const initializeUserPermissions = (userId: string) => {
    setEditingPermissions(prev => ({
      ...prev,
      [userId]: PERMISSION_FEATURES.reduce((acc, f) => {
        acc[f.key] = 'none';
        return acc;
      }, {} as Record<string, string>)
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
        toast({
          title: 'Operação não permitida',
          description: 'Rafael Egg Nunes não pode ter seus privilégios removidos',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Admin removido',
        description: 'Privilégios de administrador removidos',
      });
      setAdminUserIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleSave = async (userId: string) => {
    setSaving(userId);

    const permsToSave = editingPermissions[userId] || {};
    const permRecord: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      permRecord[`perm_${f.key}`] = permsToSave[f.key] || 'none';
    });

    const existingPerm = permissions[userId];

    try {
      if (existingPerm) {
        // Update existing
        const { error } = await supabase
          .from('admin_permissions')
          .update(permRecord)
          .eq('admin_user_id', userId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('admin_permissions')
          .insert({
            admin_user_id: userId,
            created_by: user?.id,
            ...permRecord
          });

        if (error) throw error;
      }

      toast({
        title: 'Permissões salvas',
        description: 'As permissões foram atualizadas com sucesso.',
      });

      fetchPermissions();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as permissões.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const setAllPermissions = (userId: string, level: string) => {
    const newPerms: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      newPerms[f.key] = level;
    });
    setEditingPermissions(prev => ({
      ...prev,
      [userId]: newPerms
    }));
  };

  // Filter users based on search and group
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = searchQuery === '' || 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isAdmin = adminUserIds.has(u.id);
    const matchesGroup = filterGroup === 'all' || 
      (filterGroup === 'admin' && isAdmin) ||
      (filterGroup === 'user' && !isAdmin);
    
    return matchesSearch && matchesGroup;
  });

  const adminCount = allUsers.filter(u => adminUserIds.has(u.id)).length;
  const userCount = allUsers.filter(u => !adminUserIds.has(u.id)).length;

  const getPositionLabel = (position: string | null) => {
    switch (position) {
      case 'socio': return 'Sócio';
      case 'advogado': return 'Advogado';
      case 'estagiario': return 'Estagiário';
      case 'comercial': return 'Comercial';
      case 'administrativo': return 'Administrativo';
      default: return position || 'Não definido';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Gerenciamento de Permissões
        </CardTitle>
        <CardDescription>
          Defina o grupo (Admin/Usuário) e as permissões específicas de cada colaborador. Sócios têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search and Filter */}
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
          <Tabs value={filterGroup} onValueChange={(v) => setFilterGroup(v as typeof filterGroup)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Users className="h-4 w-4" />
                Todos ({allUsers.length})
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="h-4 w-4" />
                Admins ({adminCount})
              </TabsTrigger>
              <TabsTrigger value="user" className="gap-2">
                <User className="h-4 w-4" />
                Usuários ({userCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum usuário encontrado com os filtros selecionados.
          </p>
        ) : (
          <div className="space-y-6">
            {filteredUsers.map(userItem => {
              const isAdmin = adminUserIds.has(userItem.id);
              
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{userItem.full_name}</p>
                            {isAdmin && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="w-3 h-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{userItem.email}</p>
                          {userItem.position && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {getPositionLabel(userItem.position)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Grupo: Admin ou Usuário */}
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveAdmin(userItem.id)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <User className="h-4 w-4" />
                            Tornar Usuário Comum
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleMakeAdmin(userItem.id)}
                            className="gap-2"
                          >
                            <Shield className="h-4 w-4" />
                            Tornar Administrador
                          </Button>
                        )}
                        
                        {/* Quick permission buttons */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAllPermissions(userItem.id, 'none')}
                        >
                          Nenhum
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAllPermissions(userItem.id, 'view')}
                        >
                          Todos Visualizar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAllPermissions(userItem.id, 'edit')}
                        >
                          Todos Editar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {PERMISSION_FEATURES.map(feature => {
                        const currentValue = editingPermissions[userItem.id]?.[feature.key] || 
                                            (permissions[userItem.id] as any)?.[`perm_${feature.key}`] || 
                                            'none';
                        
                        if (!editingPermissions[userItem.id]) {
                          initializeUserPermissions(userItem.id);
                        }

                        return (
                          <div key={feature.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border">
                            <div className="flex-1 min-w-0 mr-2">
                              <p className="text-sm font-medium truncate">{feature.label}</p>
                            </div>
                            <Select
                              value={currentValue}
                              onValueChange={(value) => handlePermissionChange(userItem.id, feature.key, value)}
                            >
                              <SelectTrigger className="w-[130px]">
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
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => handleSave(userItem.id)} disabled={saving === userItem.id}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving === userItem.id ? 'Salvando...' : 'Salvar Permissões'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
