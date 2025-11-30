import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Transaction {
  date: string;
  amount: number;
  type: 'income' | 'expense';
}

interface FinancialPredictionsProps {
  transactions: Transaction[];
}

export function FinancialPredictions({ transactions }: FinancialPredictionsProps) {
  // Regressão linear simples
  const linearRegression = (xValues: number[], yValues: number[]) => {
    const n = xValues.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  };

  const getPredictions = () => {
    if (transactions.length < 2) return null;

    // Agregar dados mensais
    const monthlyData: Record<string, { income: number; expense: number; date: Date }> = {};

    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = format(date, 'MM/yyyy');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, date };
      }

      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expense += t.amount;
      }
    });

    const sortedMonths = Object.entries(monthlyData).sort(
      ([, a], [, b]) => a.date.getTime() - b.date.getTime()
    );

    if (sortedMonths.length < 2) return null;

    // Preparar dados para regressão
    const xValues = sortedMonths.map((_, i) => i);
    const incomeValues = sortedMonths.map(([, data]) => data.income);
    const expenseValues = sortedMonths.map(([, data]) => data.expense);

    // Calcular regressões
    const incomeRegression = linearRegression(xValues, incomeValues);
    const expenseRegression = linearRegression(xValues, expenseValues);

    // Gerar previsões para os próximos 3 meses
    const predictions = [];
    const lastMonth = sortedMonths[sortedMonths.length - 1][1].date;

    for (let i = 1; i <= 3; i++) {
      const futureMonth = addMonths(lastMonth, i);
      const x = sortedMonths.length - 1 + i;

      const predictedIncome = Math.max(0, incomeRegression.slope * x + incomeRegression.intercept);
      const predictedExpense = Math.max(0, expenseRegression.slope * x + expenseRegression.intercept);

      predictions.push({
        month: format(futureMonth, 'MM/yyyy', { locale: ptBR }),
        receitas: Math.round(predictedIncome),
        despesas: Math.round(predictedExpense),
        tipo: 'previsão' as const,
      });
    }

    // Combinar dados históricos com previsões
    const historicalData = sortedMonths.slice(-6).map(([key, data]) => ({
      month: key,
      receitas: data.income,
      despesas: data.expense,
      tipo: 'histórico' as const,
    }));

    return {
      chartData: [...historicalData, ...predictions],
      predictions,
      trend: {
        income: incomeRegression.slope > 0 ? 'up' : incomeRegression.slope < 0 ? 'down' : 'stable',
        expense: expenseRegression.slope > 0 ? 'up' : expenseRegression.slope < 0 ? 'down' : 'stable',
      },
    };
  };

  const predictionData = getPredictions();

  if (!predictionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Análise Preditiva
          </CardTitle>
          <CardDescription>Dados insuficientes para gerar previsões</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Requer pelo menos 2 meses de dados históricos para realizar análise preditiva.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Análise Preditiva - Próximos 3 Meses
        </CardTitle>
        <CardDescription>
          Previsão baseada em regressão linear dos dados históricos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tendências */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Tendência de Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {predictionData.trend.income === 'up' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <Badge className="bg-green-600">Crescimento</Badge>
                  </>
                )}
                {predictionData.trend.income === 'down' && (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    <Badge variant="destructive">Declínio</Badge>
                  </>
                )}
                {predictionData.trend.income === 'stable' && (
                  <>
                    <Activity className="h-5 w-5 text-gray-600" />
                    <Badge variant="outline">Estável</Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Tendência de Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {predictionData.trend.expense === 'up' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-red-600" />
                    <Badge variant="destructive">Aumento</Badge>
                  </>
                )}
                {predictionData.trend.expense === 'down' && (
                  <>
                    <TrendingDown className="h-5 w-5 text-green-600" />
                    <Badge className="bg-green-600">Redução</Badge>
                  </>
                )}
                {predictionData.trend.expense === 'stable' && (
                  <>
                    <Activity className="h-5 w-5 text-gray-600" />
                    <Badge variant="outline">Estável</Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Previsão */}
        <ChartContainer
          config={{
            receitas: {
              label: 'Receitas',
              color: 'hsl(var(--chart-1))',
            },
            despesas: {
              label: 'Despesas',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-[350px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={predictionData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number, name: string, props: any) => [
                  formatCurrency(value),
                  `${name} ${props.payload.tipo === 'previsão' ? '(previsto)' : ''}`,
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="receitas"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="hsl(var(--chart-1))"
                      stroke="white"
                      strokeWidth={2}
                      opacity={payload.tipo === 'previsão' ? 0.6 : 1}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="despesas"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="hsl(var(--chart-2))"
                      stroke="white"
                      strokeWidth={2}
                      opacity={payload.tipo === 'previsão' ? 0.6 : 1}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Previsões Detalhadas */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Previsões Mensais</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {predictionData.predictions.map((pred, index) => (
              <Card key={index} className="border-2 border-dashed">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium mb-2">{pred.month}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receitas:</span>
                      <span className="font-medium text-green-600">{formatCurrency(pred.receitas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Despesas:</span>
                      <span className="font-medium text-red-600">{formatCurrency(pred.despesas)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Saldo:</span>
                      <span
                        className={`font-bold ${
                          pred.receitas - pred.despesas >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(pred.receitas - pred.despesas)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          * As previsões são baseadas em análise de regressão linear e devem ser usadas apenas como referência.
          Fatores externos e mudanças no mercado podem afetar os resultados reais.
        </p>
      </CardContent>
    </Card>
  );
}
