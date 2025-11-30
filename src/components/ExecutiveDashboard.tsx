import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, CheckCircle, AlertTriangle, Plus, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface FinancialGoal {
  id: string;
  goal_type: string;
  target_value: number;
  year: number;
  quarter?: number;
  month?: number;
}

interface KPI {
  label: string;
  value: number;
  target: number;
  progress: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface ExecutiveDashboardProps {
  totalIncome: number;
  totalExpense: number;
  profitMargin: number;
  period: string;
}

export function ExecutiveDashboard({ totalIncome, totalExpense, profitMargin, period }: ExecutiveDashboardProps) {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    goal_type: 'monthly_revenue' as const,
    target_value: 0,
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user, period]);

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .eq('year', currentYear);

    if (error) {
      console.error('Error fetching goals:', error);
      return;
    }

    setGoals((data || []) as FinancialGoal[]);
  };

  const createGoal = async () => {
    if (!user || newGoal.target_value <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'A meta deve ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    const goalData: any = {
      user_id: user.id,
      goal_type: newGoal.goal_type,
      target_value: newGoal.target_value,
      year: currentYear,
      is_active: true,
    };

    if (newGoal.goal_type.startsWith('monthly')) {
      goalData.month = currentMonth;
    } else if (newGoal.goal_type.startsWith('quarterly')) {
      goalData.quarter = currentQuarter;
    }

    const { error } = await supabase.from('financial_goals').insert(goalData);

    if (error) {
      toast({
        title: 'Erro ao criar meta',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Meta criada',
      description: 'A meta financeira foi configurada com sucesso.',
    });

    setShowDialog(false);
    setNewGoal({ goal_type: 'monthly_revenue', target_value: 0 });
    fetchGoals();
  };

  const getKPIs = (): KPI[] => {
    const kpis: KPI[] = [];
    const profit = totalIncome - totalExpense;

    // Encontrar metas relevantes para o período atual
    let revenueGoal: FinancialGoal | undefined;
    let profitGoal: FinancialGoal | undefined;

    if (period === 'month') {
      revenueGoal = goals.find((g) => g.goal_type === 'monthly_revenue' && g.month === currentMonth);
      profitGoal = goals.find((g) => g.goal_type === 'monthly_profit' && g.month === currentMonth);
    } else if (period === 'quarter') {
      revenueGoal = goals.find((g) => g.goal_type === 'quarterly_revenue' && g.quarter === currentQuarter);
      profitGoal = goals.find((g) => g.goal_type === 'quarterly_profit' && g.quarter === currentQuarter);
    } else if (period === 'year') {
      revenueGoal = goals.find((g) => g.goal_type === 'yearly_revenue');
      profitGoal = goals.find((g) => g.goal_type === 'yearly_profit');
    }

    // KPI de Receita
    if (revenueGoal) {
      const progress = (totalIncome / revenueGoal.target_value) * 100;
      kpis.push({
        label: 'Receita',
        value: totalIncome,
        target: revenueGoal.target_value,
        progress: Math.min(progress, 100),
        status:
          progress >= 100
            ? 'excellent'
            : progress >= 80
            ? 'good'
            : progress >= 60
            ? 'warning'
            : 'critical',
      });
    }

    // KPI de Lucro
    if (profitGoal) {
      const progress = (profit / profitGoal.target_value) * 100;
      kpis.push({
        label: 'Lucro',
        value: profit,
        target: profitGoal.target_value,
        progress: Math.min(progress, 100),
        status:
          progress >= 100
            ? 'excellent'
            : progress >= 80
            ? 'good'
            : progress >= 60
            ? 'warning'
            : 'critical',
      });
    }

    // KPI de Margem de Lucro (sempre visível se houver receita)
    if (totalIncome > 0) {
      const targetMargin = 20; // Meta padrão de 20%
      const progress = (profitMargin / targetMargin) * 100;
      kpis.push({
        label: 'Margem de Lucro',
        value: profitMargin,
        target: targetMargin,
        progress: Math.min(progress, 100),
        status:
          profitMargin >= 20
            ? 'excellent'
            : profitMargin >= 15
            ? 'good'
            : profitMargin >= 10
            ? 'warning'
            : 'critical',
      });
    }

    return kpis;
  };

  const kpis = getKPIs();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50';
      case 'good':
        return 'text-blue-600 bg-blue-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Excelente';
      case 'good':
        return 'Bom';
      case 'warning':
        return 'Atenção';
      case 'critical':
        return 'Crítico';
      default:
        return 'N/A';
    }
  };

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      monthly_revenue: 'Receita Mensal',
      monthly_profit: 'Lucro Mensal',
      quarterly_revenue: 'Receita Trimestral',
      quarterly_profit: 'Lucro Trimestral',
      yearly_revenue: 'Receita Anual',
      yearly_profit: 'Lucro Anual',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Dashboard Executivo
            </CardTitle>
            <CardDescription>KPIs principais e comparação com metas estabelecidas</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Metas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Nova Meta</DialogTitle>
                <DialogDescription>
                  Defina metas financeiras para {period === 'month' ? 'este mês' : period === 'quarter' ? 'este trimestre' : 'este ano'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tipo de Meta</Label>
                  <Select
                    value={newGoal.goal_type}
                    onValueChange={(value: any) => setNewGoal({ ...newGoal, goal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly_revenue">Receita Mensal</SelectItem>
                      <SelectItem value="monthly_profit">Lucro Mensal</SelectItem>
                      <SelectItem value="quarterly_revenue">Receita Trimestral</SelectItem>
                      <SelectItem value="quarterly_profit">Lucro Trimestral</SelectItem>
                      <SelectItem value="yearly_revenue">Receita Anual</SelectItem>
                      <SelectItem value="yearly_profit">Lucro Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor da Meta (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newGoal.target_value || ''}
                    onChange={(e) => setNewGoal({ ...newGoal, target_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={createGoal} className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Meta
                  </Button>
                  <Button onClick={() => setShowDialog(false)} variant="outline">
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs Cards */}
        {kpis.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kpis.map((kpi, index) => (
              <Card key={index} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                    <Badge className={getStatusColor(kpi.status)}>{getStatusLabel(kpi.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-2xl font-bold">
                        {kpi.label === 'Margem de Lucro' ? `${kpi.value.toFixed(1)}%` : formatCurrency(kpi.value)}
                      </span>
                      {kpi.status === 'excellent' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : kpi.status === 'critical' ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Meta: {kpi.label === 'Margem de Lucro' ? `${kpi.target}%` : formatCurrency(kpi.target)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{kpi.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={kpi.progress} className="h-2" />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {kpi.label === 'Margem de Lucro'
                      ? `${kpi.value >= kpi.target ? '+' : ''}${(kpi.value - kpi.target).toFixed(1)}% ${
                          kpi.value >= kpi.target ? 'acima' : 'abaixo'
                        } da meta`
                      : `${kpi.value >= kpi.target ? '+' : ''}${formatCurrency(kpi.value - kpi.target)} ${
                          kpi.value >= kpi.target ? 'acima' : 'abaixo'
                        } da meta`}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="pt-6 text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">Nenhuma meta configurada</p>
              <p className="text-sm text-muted-foreground mb-4">
                Configure metas para acompanhar o desempenho financeiro
              </p>
              <Button onClick={() => setShowDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Configurar Primeira Meta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lista de Metas Ativas */}
        {goals.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Metas Configuradas ({goals.length})</h4>
            <div className="space-y-2">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{getGoalTypeLabel(goal.goal_type)}</span>
                    <p className="text-xs text-muted-foreground">
                      Meta: {formatCurrency(goal.target_value)}
                      {goal.month && ` - ${goal.month}/${goal.year}`}
                      {goal.quarter && ` - Q${goal.quarter}/${goal.year}`}
                      {!goal.month && !goal.quarter && ` - ${goal.year}`}
                    </p>
                  </div>
                  <Badge variant="outline">Ativa</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
