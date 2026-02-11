import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, Smartphone, Save, CheckCircle2, Users, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface NotificationSettings {
  id?: string;
  user_id: string;
  notify_days_before: number;
  notify_on_due_date: boolean;
  notify_when_overdue: boolean;
  push_notifications: boolean;
  notification_time: string;
}

interface AdminRecipient {
  id: string;
  admin_user_id: string;
  receive_overdue_alerts: boolean;
  receive_due_today_alerts: boolean;
  receive_due_soon_alerts: boolean;
  profile?: {
    full_name: string;
    email: string;
  };
}

interface AdminUser {
  user_id: string;
  profile: {
    full_name: string;
    email: string;
  };
}

export const TaskNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminRecipients, setAdminRecipients] = useState<AdminRecipient[]>([]);
  const [savingAdmins, setSavingAdmins] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchSettings();
    checkPushPermission();
    if (isAdmin) {
      fetchAdminUsers();
      fetchAdminRecipients();
    }
  }, [isAdmin]);

  const checkPushPermission = () => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  };

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        toast({
          title: 'Notificações ativadas',
          description: 'Você receberá notificações push para suas tarefas.',
        });
      } else if (permission === 'denied') {
        toast({
          title: 'Permissão negada',
          description: 'Você pode ativar as notificações nas configurações do navegador.',
          variant: 'destructive',
        });
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('task_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...data,
          push_notifications: data.push_notifications ?? true,
        } as NotificationSettings);
      } else {
        setSettings({
          user_id: user.id,
          notify_days_before: 3,
          notify_on_due_date: true,
          notify_when_overdue: true,
          push_notifications: true,
          notification_time: '09:00',
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar suas configurações de notificação.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profile:profiles!user_roles_user_id_fkey(full_name, email)
        `)
        .eq('role', 'admin');

      if (error) {
        // Fallback: buscar admins de outra forma
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (roles) {
          const userIds = roles.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          if (profiles) {
            setAdminUsers(profiles.map(p => ({
              user_id: p.id,
              profile: { full_name: p.full_name, email: p.email }
            })));
          }
        }
        return;
      }

      if (data) {
        const admins = data.map((item: any) => ({
          user_id: item.user_id,
          profile: Array.isArray(item.profile) ? item.profile[0] : item.profile
        })).filter((admin: AdminUser) => admin.profile);
        setAdminUsers(admins);
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  };

  const fetchAdminRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_task_notification_recipients')
        .select('*');

      if (error) throw error;
      setAdminRecipients(data || []);
    } catch (error) {
      console.error('Error fetching admin recipients:', error);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (settings.id) {
        const { error } = await supabase
          .from('task_notification_settings')
          .update({
            notify_days_before: settings.notify_days_before,
            notify_on_due_date: settings.notify_on_due_date,
            notify_when_overdue: settings.notify_when_overdue,
            push_notifications: settings.push_notifications,
            notification_time: settings.notification_time,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('task_notification_settings')
          .insert({
            user_id: user.id,
            notify_days_before: settings.notify_days_before,
            notify_on_due_date: settings.notify_on_due_date,
            notify_when_overdue: settings.notify_when_overdue,
            push_notifications: settings.push_notifications,
            notification_time: settings.notification_time,
          })
          .select()
          .single();

        if (error) throw error;
        setSettings(data as NotificationSettings);
      }

      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências de notificação foram atualizadas.',
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar suas configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAdminRecipient = async (adminUserId: string, checked: boolean) => {
    setSavingAdmins(true);
    try {
      if (checked) {
        const { error } = await supabase
          .from('admin_task_notification_recipients')
          .insert({
            admin_user_id: adminUserId,
            receive_overdue_alerts: true,
            receive_due_today_alerts: true,
            receive_due_soon_alerts: true,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_task_notification_recipients')
          .delete()
          .eq('admin_user_id', adminUserId);

        if (error) throw error;
      }

      await fetchAdminRecipients();
      toast({
        title: checked ? 'Admin adicionado' : 'Admin removido',
        description: checked 
          ? 'O administrador receberá alertas de tarefas.' 
          : 'O administrador não receberá mais alertas.',
      });
    } catch (error) {
      console.error('Error toggling admin recipient:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração.',
        variant: 'destructive',
      });
    } finally {
      setSavingAdmins(false);
    }
  };

  const updateAdminAlertType = async (
    adminUserId: string,
    field: 'receive_overdue_alerts' | 'receive_due_today_alerts' | 'receive_due_soon_alerts',
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('admin_task_notification_recipients')
        .update({ [field]: value })
        .eq('admin_user_id', adminUserId);

      if (error) throw error;

      setAdminRecipients(prev => prev.map(r => 
        r.admin_user_id === adminUserId ? { ...r, [field]: value } : r
      ));
    } catch (error) {
      console.error('Error updating alert type:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a configuração.',
        variant: 'destructive',
      });
    }
  };

  const isAdminSelected = (adminUserId: string) => {
    return adminRecipients.some(r => r.admin_user_id === adminUserId);
  };

  const getAdminRecipient = (adminUserId: string) => {
    return adminRecipients.find(r => r.admin_user_id === adminUserId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configurações de Notificação
          </CardTitle>
          <CardDescription>
            Configure como e quando deseja receber alertas sobre suas tarefas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notification Permission */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notificações do Navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Receba alertas mesmo quando a página estiver em segundo plano
                  </p>
                </div>
              </div>
              {pushPermission === 'granted' ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Ativado
                </Badge>
              ) : pushPermission === 'denied' ? (
                <Badge variant="destructive">
                  <BellOff className="h-3 w-3 mr-1" />
                  Bloqueado
                </Badge>
              ) : (
                <Button size="sm" onClick={requestPushPermission}>
                  <Bell className="h-4 w-4 mr-2" />
                  Ativar
                </Button>
              )}
            </div>
          </div>

          {/* Notification Types */}
          <div className="space-y-4">
            <h4 className="font-medium">Tipos de Alerta</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-notifications">Notificações Push</Label>
                <p className="text-sm text-muted-foreground">
                  Alertas no navegador sobre prazos
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={settings.push_notifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, push_notifications: checked })
                }
                disabled={pushPermission !== 'granted'}
              />
            </div>
          </div>

          {/* When to Notify */}
          <div className="space-y-4">
            <h4 className="font-medium">Quando Notificar</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-due-date">No dia do vencimento</Label>
                <p className="text-sm text-muted-foreground">
                  Alertar quando a tarefa vencer hoje
                </p>
              </div>
              <Switch
                id="notify-due-date"
                checked={settings.notify_on_due_date}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_on_due_date: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-overdue">Quando atrasada</Label>
                <p className="text-sm text-muted-foreground">
                  Alertar sobre tarefas atrasadas
                </p>
              </div>
              <Switch
                id="notify-overdue"
                checked={settings.notify_when_overdue}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_when_overdue: checked })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notify-days">Antecipar alertas (dias antes)</Label>
              <Input
                id="notify-days"
                type="number"
                min={1}
                max={30}
                value={settings.notify_days_before}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notify_days_before: parseInt(e.target.value) || 3,
                  })
                }
                className="w-24"
              />
              <p className="text-sm text-muted-foreground">
                Receber alertas {settings.notify_days_before} dia(s) antes do vencimento
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notify-time">Horário das notificações</Label>
              <Input
                id="notify-time"
                type="time"
                value={settings.notification_time}
                onChange={(e) =>
                  setSettings({ ...settings, notification_time: e.target.value })
                }
                className="w-32"
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Notification Recipients - Only visible to admins */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Alertas para Administradores
            </CardTitle>
            <CardDescription>
              Selecione quais administradores devem receber alertas sobre tarefas da equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto max-h-[600px]">
              <div className="space-y-4">
                {adminUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum administrador encontrado
                  </p>
                ) : (
                  adminUsers.map((admin) => {
                    const isSelected = isAdminSelected(admin.user_id);
                    const recipient = getAdminRecipient(admin.user_id);

                    return (
                      <div key={admin.user_id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`admin-${admin.user_id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleAdminRecipient(admin.user_id, checked as boolean)
                              }
                              disabled={savingAdmins}
                            />
                            <div>
                              <Label htmlFor={`admin-${admin.user_id}`} className="font-medium cursor-pointer">
                                {admin.profile?.full_name}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {admin.profile?.email}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          )}
                        </div>

                        {isSelected && recipient && (
                          <div className="ml-7 pt-3 border-t space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Tipos de alerta:</p>
                            <div className="flex flex-wrap gap-4">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`overdue-${admin.user_id}`}
                                  checked={recipient.receive_overdue_alerts}
                                  onCheckedChange={(checked) =>
                                    updateAdminAlertType(admin.user_id, 'receive_overdue_alerts', checked as boolean)
                                  }
                                />
                                <Label htmlFor={`overdue-${admin.user_id}`} className="text-sm cursor-pointer">
                                  Tarefas atrasadas
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`today-${admin.user_id}`}
                                  checked={recipient.receive_due_today_alerts}
                                  onCheckedChange={(checked) =>
                                    updateAdminAlertType(admin.user_id, 'receive_due_today_alerts', checked as boolean)
                                  }
                                />
                                <Label htmlFor={`today-${admin.user_id}`} className="text-sm cursor-pointer">
                                  Vencem hoje
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`soon-${admin.user_id}`}
                                  checked={recipient.receive_due_soon_alerts}
                                  onCheckedChange={(checked) =>
                                    updateAdminAlertType(admin.user_id, 'receive_due_soon_alerts', checked as boolean)
                                  }
                                />
                                <Label htmlFor={`soon-${admin.user_id}`} className="text-sm cursor-pointer">
                                  Vencem em breve
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};