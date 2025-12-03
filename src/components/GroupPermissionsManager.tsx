import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Save, Eye, Edit3, Ban, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

const GROUP_LABELS: Record<string, string> = {
  admin: 'Administradores',
  advogado: 'Advogados',
  estagiario: 'Estagiários',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
  user: 'Usuário Padrão',
};

export const GroupPermissionsManager = () => {
  const [groups, setGroups] = useState<GroupPermission[]>([]);
  const [editingGroups, setEditingGroups] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from('position_permission_defaults')
      .select('*')
      .order('is_admin_group', { ascending: false });

    if (error) {
      console.error('Error fetching groups:', error);
      return;
    }

    setGroups(data || []);

    // Initialize editing state
    const editState: Record<string, Record<string, string>> = {};
    data?.forEach(g => {
      editState[g.position] = {};
      PERMISSION_FEATURES.forEach(f => {
        const key = `perm_${f.key}` as keyof GroupPermission;
        editState[g.position][f.key] = g[key] as string;
      });
    });
    setEditingGroups(editState);
  };

  const handlePermissionChange = (position: string, feature: string, value: string) => {
    setEditingGroups(prev => ({
      ...prev,
      [position]: {
        ...(prev[position] || {}),
        [feature]: value
      }
    }));
  };

  const handleSave = async (position: string) => {
    setSaving(position);

    const permsToSave = editingGroups[position] || {};
    const permRecord: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      permRecord[`perm_${f.key}`] = permsToSave[f.key] || 'none';
    });

    const { error } = await supabase
      .from('position_permission_defaults')
      .update(permRecord)
      .eq('position', position);

    if (error) {
      console.error('Error saving group permissions:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as permissões do grupo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Permissões salvas',
        description: `Permissões do grupo ${GROUP_LABELS[position] || position} atualizadas.`,
      });
      fetchGroups();
    }

    setSaving(null);
  };

  const setAllPermissions = (position: string, level: string) => {
    const newPerms: Record<string, string> = {};
    PERMISSION_FEATURES.forEach(f => {
      newPerms[f.key] = level;
    });
    setEditingGroups(prev => ({
      ...prev,
      [position]: newPerms
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Permissões por Grupo
        </CardTitle>
        <CardDescription>
          Configure as permissões padrão para cada grupo. Usuários herdam as permissões do seu grupo automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map(group => (
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
                      Permissões padrão para usuários do grupo {GROUP_LABELS[group.position]?.toLowerCase() || group.position}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllPermissions(group.position, 'none')}
                  >
                    Nenhum
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllPermissions(group.position, 'view')}
                  >
                    Todos Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllPermissions(group.position, 'edit')}
                  >
                    Todos Editar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PERMISSION_FEATURES.map(feature => {
                  const currentValue = editingGroups[group.position]?.[feature.key] || 'none';

                  return (
                    <div key={feature.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium truncate">{feature.label}</p>
                      </div>
                      <Select
                        value={currentValue}
                        onValueChange={(value) => handlePermissionChange(group.position, feature.key, value)}
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
                <Button onClick={() => handleSave(group.position)} disabled={saving === group.position}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving === group.position ? 'Salvando...' : 'Salvar Permissões do Grupo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
