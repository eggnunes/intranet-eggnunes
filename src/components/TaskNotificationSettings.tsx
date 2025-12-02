import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Mail, Smartphone, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  id?: string;
  user_id: string;
  notify_days_before: number;
  notify_on_due_date: boolean;
  notify_when_overdue: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  notification_time: string;
}

export const TaskNotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    checkPushPermission();
  }, []);

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
        setSettings(data as NotificationSettings);
      } else {
        // Create default settings
        setSettings({
          user_id: user.id,
          notify_days_before: 3,
          notify_on_due_date: true,
          notify_when_overdue: true,
          email_notifications: false,
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

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from('task_notification_settings')
          .update({
            notify_days_before: settings.notify_days_before,
            notify_on_due_date: settings.notify_on_due_date,
            notify_when_overdue: settings.notify_when_overdue,
            email_notifications: settings.email_notifications,
            push_notifications: settings.push_notifications,
            notification_time: settings.notification_time,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('task_notification_settings')
          .insert({
            user_id: user.id,
            notify_days_before: settings.notify_days_before,
            notify_on_due_date: settings.notify_on_due_date,
            notify_when_overdue: settings.notify_when_overdue,
            email_notifications: settings.email_notifications,
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

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Notificações por Email</Label>
              <p className="text-sm text-muted-foreground">
                Receba resumos diários por email
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Em breve
              </Badge>
              <Switch
                id="email-notifications"
                checked={settings.email_notifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_notifications: checked })
                }
                disabled
              />
            </div>
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
  );
};
