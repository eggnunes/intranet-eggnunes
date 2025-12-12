import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bell, AlertTriangle, Clock, Calendar, Check, Trash2, Settings, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CRMNotification {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AlertSettings {
  id: string;
  stale_deal_days: number;
  close_date_warning_days: number;
  enable_stale_alerts: boolean;
  enable_close_date_alerts: boolean;
  enable_follow_up_alerts: boolean;
}

export const CRMNotifications = () => {
  const { user } = useAuth();
  const { profile } = useUserRole();
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isSocio = profile?.position === 'socio' || profile?.email === 'rafael@eggnunes.com.br';

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchSettings();
      generateAlerts();
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('crm_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('crm_alert_settings')
      .select('*')
      .single();
    
    if (data) {
      setSettings(data);
    }
  };

  const generateAlerts = async () => {
    if (!user) return;

    try {
      // Fetch settings first
      const { data: settingsData } = await supabase
        .from('crm_alert_settings')
        .select('*')
        .single();

      if (!settingsData) return;

      // Fetch deals with stages
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`
          *,
          stage:crm_deal_stages(name, is_won, is_lost)
        `)
        .is('closed_at', null);

      if (!deals) return;

      const now = new Date();
      const newNotifications: { user_id: string; deal_id: string; type: string; title: string; message: string }[] = [];

      // Check for stale deals
      if (settingsData.enable_stale_alerts) {
        const staleDays = settingsData.stale_deal_days || 7;
        deals.forEach(deal => {
          const lastUpdate = new Date(deal.updated_at);
          const daysSinceUpdate = Math.ceil((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceUpdate >= staleDays && !deal.stage?.is_won && !deal.stage?.is_lost) {
            newNotifications.push({
              user_id: user.id,
              deal_id: deal.id,
              type: 'stale_deal',
              title: `Deal parado há ${daysSinceUpdate} dias`,
              message: `"${deal.name}" está sem movimentação há ${daysSinceUpdate} dias. Considere fazer um follow-up.`,
            });
          }
        });
      }

      // Check for deals near expected close date
      if (settingsData.enable_close_date_alerts) {
        const warningDays = settingsData.close_date_warning_days || 3;
        deals.forEach(deal => {
          if (deal.expected_close_date) {
            const closeDate = new Date(deal.expected_close_date);
            const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilClose <= warningDays && daysUntilClose >= 0) {
              newNotifications.push({
                user_id: user.id,
                deal_id: deal.id,
                type: 'close_date_near',
                title: `Fechamento previsto em ${daysUntilClose} dia(s)`,
                message: `"${deal.name}" tem fechamento previsto para ${new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}.`,
              });
            } else if (daysUntilClose < 0) {
              newNotifications.push({
                user_id: user.id,
                deal_id: deal.id,
                type: 'close_date_near',
                title: `Fechamento atrasado`,
                message: `"${deal.name}" deveria ter sido fechado em ${new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}.`,
              });
            }
          }
        });
      }

      // Insert new notifications (avoid duplicates for the same deal/type today)
      for (const notif of newNotifications) {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('crm_notifications')
          .select('id')
          .eq('deal_id', notif.deal_id)
          .eq('type', notif.type)
          .gte('created_at', today)
          .single();

        if (!existing) {
          await supabase.from('crm_notifications').insert(notif);
        }
      }

      fetchNotifications();
    } catch (error) {
      console.error('Error generating alerts:', error);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('crm_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('crm_notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notificação removida');
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('crm_notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    }
  };

  const updateSettings = async () => {
    if (!settings) return;

    const { error } = await supabase
      .from('crm_alert_settings')
      .update({
        stale_deal_days: settings.stale_deal_days,
        close_date_warning_days: settings.close_date_warning_days,
        enable_stale_alerts: settings.enable_stale_alerts,
        enable_close_date_alerts: settings.enable_close_date_alerts,
        enable_follow_up_alerts: settings.enable_follow_up_alerts,
      })
      .eq('id', settings.id);

    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações salvas com sucesso');
      setSettingsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stale_deal':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'close_date_near':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'follow_up':
        return <Bell className="h-4 w-4 text-green-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'stale_deal':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Deal Parado</Badge>;
      case 'close_date_near':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Fechamento</Badge>;
      case 'follow_up':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Follow-up</Badge>;
      default:
        return <Badge variant="outline">Alerta</Badge>;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Notificações CRM</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} não lidas</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <Check className="h-4 w-4 mr-1" />
            Marcar todas como lidas
          </Button>
          {isSocio && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-1" />
                  Configurar Alertas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurações de Alertas</DialogTitle>
                </DialogHeader>
                {settings && (
                  <div className="space-y-6 py-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Alertas de Deals Parados</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar quando um deal ficar parado
                          </p>
                        </div>
                        <Switch
                          checked={settings.enable_stale_alerts}
                          onCheckedChange={(checked) => 
                            setSettings(prev => prev ? {...prev, enable_stale_alerts: checked} : null)
                          }
                        />
                      </div>
                      {settings.enable_stale_alerts && (
                        <div className="ml-4">
                          <Label>Dias sem movimentação</Label>
                          <Input
                            type="number"
                            value={settings.stale_deal_days}
                            onChange={(e) => 
                              setSettings(prev => prev ? {...prev, stale_deal_days: parseInt(e.target.value) || 7} : null)
                            }
                            className="w-24 mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Alertas de Fechamento</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar antes da data de fechamento prevista
                          </p>
                        </div>
                        <Switch
                          checked={settings.enable_close_date_alerts}
                          onCheckedChange={(checked) => 
                            setSettings(prev => prev ? {...prev, enable_close_date_alerts: checked} : null)
                          }
                        />
                      </div>
                      {settings.enable_close_date_alerts && (
                        <div className="ml-4">
                          <Label>Dias de antecedência</Label>
                          <Input
                            type="number"
                            value={settings.close_date_warning_days}
                            onChange={(e) => 
                              setSettings(prev => prev ? {...prev, close_date_warning_days: parseInt(e.target.value) || 3} : null)
                            }
                            className="w-24 mt-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Lembretes de Follow-up</Label>
                        <p className="text-sm text-muted-foreground">
                          Receber lembretes de follow-up agendados
                        </p>
                      </div>
                      <Switch
                        checked={settings.enable_follow_up_alerts}
                        onCheckedChange={(checked) => 
                          setSettings(prev => prev ? {...prev, enable_follow_up_alerts: checked} : null)
                        }
                      />
                    </div>

                    <Button onClick={updateSettings} className="w-full">
                      Salvar Configurações
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors ${
                      !notification.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{notification.title}</span>
                          {getNotificationBadge(notification.type)}
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {new Date(notification.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
