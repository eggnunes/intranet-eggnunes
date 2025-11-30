import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Trash2, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface FinancialAlert {
  id: string;
  alert_type: 'expense_limit' | 'profit_margin_min' | 'revenue_decline';
  threshold_value: number;
  period: 'month' | 'quarter' | 'year';
  is_active: boolean;
}

interface TriggeredAlert {
  type: string;
  message: string;
  severity: 'warning' | 'error';
}

interface FinancialAlertsProps {
  totalExpense: number;
  profitMargin: number;
  growthRate: number;
  period: string;
}

export function FinancialAlerts({ totalExpense, profitMargin, growthRate, period }: FinancialAlertsProps) {
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    alert_type: 'expense_limit' as const,
    threshold_value: 0,
    period: 'month' as const,
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  useEffect(() => {
    checkAlerts();
  }, [alerts, totalExpense, profitMargin, growthRate, period]);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('financial_alerts')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching alerts:', error);
      return;
    }

    setAlerts((data || []) as FinancialAlert[]);
  };

  const checkAlerts = () => {
    const triggered: TriggeredAlert[] = [];

    alerts.forEach((alert) => {
      if (alert.period !== period && period !== 'all') return;

      switch (alert.alert_type) {
        case 'expense_limit':
          if (totalExpense > alert.threshold_value) {
            triggered.push({
              type: 'expense_limit',
              message: `Despesas (${formatCurrency(totalExpense)}) ultrapassaram o limite de ${formatCurrency(alert.threshold_value)}`,
              severity: 'error',
            });
          }
          break;
        case 'profit_margin_min':
          if (profitMargin < alert.threshold_value) {
            triggered.push({
              type: 'profit_margin_min',
              message: `Margem de lucro (${profitMargin.toFixed(2)}%) está abaixo do mínimo de ${alert.threshold_value}%`,
              severity: 'warning',
            });
          }
          break;
        case 'revenue_decline':
          if (growthRate < -alert.threshold_value) {
            triggered.push({
              type: 'revenue_decline',
              message: `Queda de receita de ${Math.abs(growthRate).toFixed(2)}% excede o limite de ${alert.threshold_value}%`,
              severity: 'error',
            });
          }
          break;
      }
    });

    setTriggeredAlerts(triggered);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const createAlert = async () => {
    if (!user || newAlert.threshold_value <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'O limite deve ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('financial_alerts').insert({
      user_id: user.id,
      alert_type: newAlert.alert_type,
      threshold_value: newAlert.threshold_value,
      period: newAlert.period,
      is_active: true,
    });

    if (error) {
      toast({
        title: 'Erro ao criar alerta',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Alerta criado',
      description: 'O alerta financeiro foi configurado com sucesso.',
    });

    setShowForm(false);
    setNewAlert({ alert_type: 'expense_limit', threshold_value: 0, period: 'month' });
    fetchAlerts();
  };

  const deleteAlert = async (id: string) => {
    const { error } = await supabase.from('financial_alerts').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao deletar alerta',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Alerta removido',
      description: 'O alerta foi deletado com sucesso.',
    });

    fetchAlerts();
  };

  const toggleAlert = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('financial_alerts').update({ is_active: isActive }).eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar alerta',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    fetchAlerts();
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'expense_limit':
        return 'Limite de Despesas';
      case 'profit_margin_min':
        return 'Margem de Lucro Mínima';
      case 'revenue_decline':
        return 'Queda de Receita';
      default:
        return type;
    }
  };

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case 'month':
        return 'Mensal';
      case 'quarter':
        return 'Trimestral';
      case 'year':
        return 'Anual';
      default:
        return p;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas Financeiros
            </CardTitle>
            <CardDescription>Configure alertas para monitorar suas métricas financeiras</CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Alerta
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertas Acionados */}
        {triggeredAlerts.length > 0 && (
          <div className="space-y-2">
            {triggeredAlerts.map((alert, index) => (
              <Alert key={index} variant={alert.severity === 'error' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.severity === 'error' ? 'Alerta Crítico' : 'Atenção'}</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {triggeredAlerts.length === 0 && alerts.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Tudo normal</AlertTitle>
            <AlertDescription>Nenhum alerta foi acionado no período atual.</AlertDescription>
          </Alert>
        )}

        {/* Formulário de Novo Alerta */}
        {showForm && (
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Alerta</Label>
                  <Select
                    value={newAlert.alert_type}
                    onValueChange={(value: any) => setNewAlert({ ...newAlert, alert_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense_limit">Limite de Despesas</SelectItem>
                      <SelectItem value="profit_margin_min">Margem de Lucro Mínima</SelectItem>
                      <SelectItem value="revenue_decline">Queda de Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Valor Limite{' '}
                    {newAlert.alert_type === 'expense_limit' ? '(R$)' : newAlert.alert_type === 'profit_margin_min' ? '(%)' : '(%)'}
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newAlert.threshold_value || ''}
                    onChange={(e) => setNewAlert({ ...newAlert, threshold_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select
                    value={newAlert.period}
                    onValueChange={(value: any) => setNewAlert({ ...newAlert, period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mensal</SelectItem>
                      <SelectItem value="quarter">Trimestral</SelectItem>
                      <SelectItem value="year">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={createAlert} className="flex-1">
                  Criar Alerta
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Alertas Configurados */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Alertas Configurados ({alerts.length})</h4>
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getAlertTypeLabel(alert.alert_type)}</span>
                    <Badge variant="outline" className="text-xs">
                      {getPeriodLabel(alert.period)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Limite:{' '}
                    {alert.alert_type === 'expense_limit'
                      ? formatCurrency(alert.threshold_value)
                      : `${alert.threshold_value}%`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={alert.is_active} onCheckedChange={(checked) => toggleAlert(alert.id, checked)} />
                  <Button onClick={() => deleteAlert(alert.id)} variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {alerts.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum alerta configurado</p>
            <p className="text-sm">Clique em "Novo Alerta" para começar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
