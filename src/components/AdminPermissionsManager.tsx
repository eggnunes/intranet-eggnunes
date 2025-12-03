import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Save, Users, Eye, Edit3, Ban } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Record<string, AdminPermissionRecord>>({});
  const [editingPermissions, setEditingPermissions] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchAdmins();
    fetchPermissions();
  }, []);

  const fetchAdmins = async () => {
    // Get all admins who are not sócios
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (!adminRoles) return;

    const adminIds = adminRoles.map(r => r.user_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, position')
      .in('id', adminIds)
      .neq('position', 'socio')
      .neq('email', 'rafael@eggnunes.com.br')
      .order('full_name');

    setAdmins(profiles || []);
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

  const initializeAdminPermissions = (adminId: string) => {
    setEditingPermissions(prev => ({
      ...prev,
      [adminId]: PERMISSION_FEATURES.reduce((acc, f) => {
        acc[f.key] = 'none';
        return acc;
      }, {} as Record<string, string>)
    }));
  };

  const handlePermissionChange = (adminId: string, feature: string, value: string) => {
    setEditingPermissions(prev => ({
      ...prev,
      [adminId]: {
        ...(prev[adminId] || {}),
        [feature]: value
      }
    }));
  };

  const handleSave = async (adminId: string) => {
    setSaving(adminId);

    const permsToSave = editingPermissions[adminId] || {};
    const permRecord: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      permRecord[`perm_${f.key}`] = permsToSave[f.key] || 'none';
    });

    const existingPerm = permissions[adminId];

    try {
      if (existingPerm) {
        // Update existing
        const { error } = await supabase
          .from('admin_permissions')
          .update(permRecord)
          .eq('admin_user_id', adminId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('admin_permissions')
          .insert({
            admin_user_id: adminId,
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

  const setAllPermissions = (adminId: string, level: string) => {
    const newPerms: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      newPerms[f.key] = level;
    });
    setEditingPermissions(prev => ({
      ...prev,
      [adminId]: newPerms
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões de Administradores
        </CardTitle>
        <CardDescription>
          Gerencie as permissões de cada administrador. Sócios têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {admins.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum administrador (não-sócio) cadastrado para gerenciar permissões.
          </p>
        ) : (
          admins.map(admin => (
            <Card key={admin.id} className="border-muted">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={admin.avatar_url || ''} />
                      <AvatarFallback>{admin.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{admin.full_name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllPermissions(admin.id, 'none')}
                    >
                      Nenhum
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllPermissions(admin.id, 'view')}
                    >
                      Todos Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAllPermissions(admin.id, 'edit')}
                    >
                      Todos Editar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PERMISSION_FEATURES.map(feature => {
                    const currentValue = editingPermissions[admin.id]?.[feature.key] || 
                                        (permissions[admin.id] as any)?.[`perm_${feature.key}`] || 
                                        'none';
                    
                    if (!editingPermissions[admin.id]) {
                      initializeAdminPermissions(admin.id);
                    }

                    return (
                      <div key={feature.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{feature.label}</p>
                        </div>
                        <Select
                          value={currentValue}
                          onValueChange={(value) => handlePermissionChange(admin.id, feature.key, value)}
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
                  <Button onClick={() => handleSave(admin.id)} disabled={saving === admin.id}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving === admin.id ? 'Salvando...' : 'Salvar Permissões'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
};
