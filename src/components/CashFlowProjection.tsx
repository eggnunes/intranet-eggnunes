import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Wallet } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, addMonths, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Transaction {
  date: string;
  amount: number;
  type: 'income' | 'expense';
}

interface CashFlowProjectionProps {
  transactions: Transaction[];
}

export function CashFlowProjection({ transactions }: CashFlowProjectionProps) {
  const getCashFlowData = () => {
    if (!transactions || transactions.length < 2) return null;

    // Filtrar apenas transações com datas válidas
    const validTransactions = transactions.filter((t) => {
      if (!t.date) return false;
      try {
        const d = parseISO(t.date);
        return !isNaN(d.getTime());
      } catch {
        return false;
      }
    });

    if (validTransactions.length < 2) return null;

    // Agrupar dados históricos por mês
    const monthlyData: Record<
      string,
      { income: number; expense: number; balance: number; date: Date }
    > = {};

    validTransactions.forEach((t) => {
      const date = parseISO(t.date);
      const monthKey = format(date, 'MM/yyyy');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, balance: 0, date };
      }

      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expense += t.amount;
      }
      monthlyData[monthKey].balance = monthlyData[monthKey].income - monthlyData[monthKey].expense;
    });

    const sortedMonths = Object.entries(monthlyData)
      .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
      .slice(-6); // Últimos 6 meses

    if (sortedMonths.length < 2) return null;

    // Calcular médias para projeção
    const recentMonths = sortedMonths.slice(-3);
    const avgIncome = recentMonths.reduce((sum, [, data]) => sum + data.income, 0) / recentMonths.length;
    const avgExpense = recentMonths.reduce((sum, [, data]) => sum + data.expense, 0) / recentMonths.length;

    // Calcular tendência (crescimento/declínio)
    const firstMonthIncome = recentMonths[0][1].income;
    const lastMonthIncome = recentMonths[recentMonths.length - 1][1].income;
    const incomeGrowthRate = firstMonthIncome > 0 ? (lastMonthIncome - firstMonthIncome) / firstMonthIncome : 0;

    const firstMonthExpense = recentMonths[0][1].expense;
    const lastMonthExpense = recentMonths[recentMonths.length - 1][1].expense;
    const expenseGrowthRate = firstMonthExpense > 0 ? (lastMonthExpense - firstMonthExpense) / firstMonthExpense : 0;

    // Criar projeção para os próximos 3 meses
    const lastMonth = sortedMonths[sortedMonths.length - 1][1].date;
    let cumulativeBalance = sortedMonths.reduce((sum, [, data]) => sum + data.balance, 0);

    const projections = [];
    for (let i = 1; i <= 3; i++) {
      const futureMonth = addMonths(lastMonth, i);
      const projectedIncome = Math.max(0, avgIncome * (1 + incomeGrowthRate * i));
      const projectedExpense = Math.max(0, avgExpense * (1 + expenseGrowthRate * i));
      const projectedBalance = projectedIncome - projectedExpense;
      cumulativeBalance += projectedBalance;

      projections.push({
        month: format(futureMonth, 'MMM/yy', { locale: ptBR }),
        entradas: Math.round(projectedIncome),
        saidas: Math.round(projectedExpense),
        saldo: Math.round(projectedBalance),
        saldoAcumulado: Math.round(cumulativeBalance),
        tipo: 'projetado' as const,
      });
    }

    // Preparar dados históricos
    const historicalData = sortedMonths.map(([key, data]) => ({
      month: format(data.date, 'MMM/yy', { locale: ptBR }),
      entradas: data.income,
      saidas: data.expense,
      saldo: data.balance,
      saldoAcumulado: 0, // Calculado abaixo
      tipo: 'real' as const,
    }));

    // Calcular saldo acumulado para histórico
    let runningBalance = 0;
    historicalData.forEach((item) => {
      runningBalance += item.saldo;
      item.saldoAcumulado = runningBalance;
    });

    return {
      chartData: [...historicalData, ...projections],
      projections,
      summary: {
        avgIncome,
        avgExpense,
        projectedCumulativeBalance: cumulativeBalance,
        incomeGrowthRate,
        expenseGrowthRate,
      },
    };
  };

  const cashFlowData = getCashFlowData();

  if (!cashFlowData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Fluxo de Caixa Projetado
          </CardTitle>
          <CardDescription>Dados insuficientes ou inválidos para projeção</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Requer pelo menos 2 meses de histórico com datas válidas para projetar fluxo de caixa.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Fluxo de Caixa Projetado
        </CardTitle>
        <CardDescription>Análise de entradas, saídas e saldo acumulado para os próximos 3 meses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo de Projeções */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4 text-green-600" />
                Entradas Médias Projetadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(cashFlowData.summary.avgIncome)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cashFlowData.summary.incomeGrowthRate > 0 ? '+' : ''}
                {(cashFlowData.summary.incomeGrowthRate * 100).toFixed(1)}% tendência
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-red-600" />
                Saídas Médias Projetadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(cashFlowData.summary.avgExpense)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cashFlowData.summary.expenseGrowthRate > 0 ? '+' : ''}
                {(cashFlowData.summary.expenseGrowthRate * 100).toFixed(1)}% tendência
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Saldo Acumulado Projetado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  cashFlowData.summary.projectedCumulativeBalance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(cashFlowData.summary.projectedCumulativeBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Em 3 meses</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Fluxo de Caixa */}
        <ChartContainer
          config={{
            entradas: {
              label: 'Entradas',
              color: 'hsl(var(--chart-1))',
            },
            saidas: {
              label: 'Saídas',
              color: 'hsl(var(--chart-2))',
            },
            saldoAcumulado: {
              label: 'Saldo Acumulado',
              color: 'hsl(var(--chart-3))',
            },
          }}
          className="h-[400px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="entradas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saldoAcumulado" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Tabela de Projeções Detalhadas */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Projeção Mensal Detalhada</h4>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium">Mês</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">Entradas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">Saídas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">Saldo Mensal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowData.chartData.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b ${item.tipo === 'projetado' ? 'bg-muted/20' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {item.month}
                          {item.tipo === 'projetado' && (
                            <Badge variant="outline" className="text-xs">
                              Projeção
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                        {formatCurrency(item.entradas)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                        {formatCurrency(item.saidas)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right font-medium ${
                          item.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(item.saldo)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right font-bold ${
                          item.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(item.saldoAcumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          * Projeções baseadas na média e tendência dos últimos 3 meses. Resultados reais podem variar.
        </p>
      </CardContent>
    </Card>
  );
}
