import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, Key, AlertTriangle, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ApiKeyAlert {
  id: string;
  event_type: string;
  api_key_id: string | null;
  api_key_name: string | null;
  expiration_date: string | null;
  is_read: boolean;
  created_at: string;
}

interface AsaasApiKeyAlertsProps {
  onAlertsRead?: () => void;
}

const EVENT_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACCESS_TOKEN_CREATED: { label: 'Chave Criada', icon: <Key className="h-4 w-4" />, variant: 'default' },
  ACCESS_TOKEN_DELETED: { label: 'Chave Excluída', icon: <Trash2 className="h-4 w-4" />, variant: 'destructive' },
  ACCESS_TOKEN_DISABLED: { label: 'Chave Desabilitada', icon: <XCircle className="h-4 w-4" />, variant: 'destructive' },
  ACCESS_TOKEN_ENABLED: { label: 'Chave Habilitada', icon: <CheckCircle className="h-4 w-4" />, variant: 'default' },
  ACCESS_TOKEN_EXPIRED: { label: 'Chave Expirada', icon: <AlertTriangle className="h-4 w-4" />, variant: 'destructive' },
  ACCESS_TOKEN_EXPIRING_SOON: { label: 'Chave Expirando', icon: <Clock className="h-4 w-4" />, variant: 'secondary' },
};

export function AsaasApiKeyAlerts({ onAlertsRead }: AsaasApiKeyAlertsProps) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ApiKeyAlert[]>([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('asaas_api_key_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('asaas_api_key_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, is_read: true } : a
      ));
      onAlertsRead?.();
      toast.success('Alerta marcado como lido');
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
      toast.error('Erro ao atualizar alerta');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('asaas_api_key_alerts')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      onAlertsRead?.();
      toast.success('Todos os alertas marcados como lidos');
    } catch (error) {
      console.error('Erro ao marcar todos como lidos:', error);
      toast.error('Erro ao atualizar alertas');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalAlerts = alerts.filter(a => 
    !a.is_read && ['ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_EXPIRING_SOON', 'ACCESS_TOKEN_DISABLED'].includes(a.event_type)
  );

  return (
    <div className="space-y-4">
      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção!</AlertTitle>
          <AlertDescription>
            Você tem {criticalAlerts.length} alerta(s) crítico(s) relacionado(s) às suas chaves de API do Asaas.
            Verifique imediatamente para evitar interrupções no serviço.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Alertas de Chaves de API
                {unreadCount > 0 && (
                  <Badge variant="destructive">{unreadCount} não lidos</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Notificações sobre alterações nas suas chaves de API do Asaas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar todos como lidos
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchAlerts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum alerta de chave de API</p>
              <p className="text-sm">Os alertas aparecerão aqui quando forem processados pelo webhook</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Data Expiração</TableHead>
                    <TableHead>Data do Alerta</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map(alert => {
                    const eventInfo = EVENT_LABELS[alert.event_type] || { 
                      label: alert.event_type, 
                      icon: <Key className="h-4 w-4" />,
                      variant: 'outline' as const 
                    };
                    return (
                      <TableRow key={alert.id} className={!alert.is_read ? 'bg-muted/50' : ''}>
                        <TableCell>
                          {!alert.is_read ? (
                            <Badge variant="secondary" className="gap-1">
                              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                              Novo
                            </Badge>
                          ) : (
                            <Badge variant="outline">Lido</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={eventInfo.variant} className="gap-1">
                              {eventInfo.icon}
                              {eventInfo.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {alert.api_key_name || alert.api_key_id || '-'}
                        </TableCell>
                        <TableCell>
                          {alert.expiration_date ? formatDate(alert.expiration_date) : '-'}
                        </TableCell>
                        <TableCell>{formatDate(alert.created_at)}</TableCell>
                        <TableCell>
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(alert.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marcar como lido
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
