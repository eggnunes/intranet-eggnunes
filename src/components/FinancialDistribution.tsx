import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Transaction {
  category: string;
  amount: number;
  type: 'income' | 'expense';
}

interface FinancialDistributionProps {
  transactions: Transaction[];
}

// Categorias sensíveis que devem ser excluídas da visualização
const EXCLUDED_CATEGORIES = [
  'DISTRIBUIÇÃO DO LUCRO',
  'DISTRIBUIÇÃO DE LUCRO',
  'DIST. LUCRO',
  'TRANSFERÊNCIA ENTRE CONTAS',
  'TRANSFERENCIA ENTRE CONTAS',
];

// Função para verificar se a categoria deve ser excluída
const shouldExcludeCategory = (category: string): boolean => {
  const categoryUpper = category.toUpperCase();
  return EXCLUDED_CATEGORIES.some(excluded => categoryUpper.includes(excluded));
};

// Função para simplificar nome da categoria (remover subcategorias)
const simplifyCategory = (category: string): string => {
  // Pega apenas a primeira parte antes de " / " se existir
  const parts = category.split(' / ');
  return parts[0].trim();
};

export function FinancialDistribution({ transactions }: FinancialDistributionProps) {
  const getDistributionData = (type: 'income' | 'expense') => {
    const categoryTotals: Record<string, number> = {};

    transactions
      .filter((t) => t.type === type)
      .filter((t) => !shouldExcludeCategory(t.category)) // Excluir categorias sensíveis
      .forEach((t) => {
        // Simplificar categoria para agrupar melhor
        const simplifiedCategory = simplifyCategory(t.category);
        categoryTotals[simplifiedCategory] = (categoryTotals[simplifiedCategory] || 0) + t.amount;
      });

    const sortedData = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        name: category,
        value: amount,
      }))
      .sort((a, b) => b.value - a.value);

    // Pegar top 5 e agrupar o resto em "Outros"
    const top5 = sortedData.slice(0, 5);
    const others = sortedData.slice(5);
    
    if (others.length > 0) {
      const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
      top5.push({
        name: 'Outros',
        value: othersTotal,
      });
    }

    return top5;
  };

  const incomeData = getDistributionData('income');
  const expenseData = getDistributionData('expense');

  const COLORS = [
    'hsl(152, 60%, 45%)',  // Verde
    'hsl(210, 70%, 50%)',  // Azul
    'hsl(280, 60%, 55%)',  // Roxo
    'hsl(35, 90%, 55%)',   // Laranja
    'hsl(340, 70%, 55%)',  // Rosa
    'hsl(200, 30%, 55%)',  // Cinza azulado (Outros)
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPercentage = (value: number, data: any[]) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  };

  const getTotal = (data: any[]) => {
    return data.reduce((sum, item) => sum + item.value, 0);
  };

  if (incomeData.length === 0 && expenseData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Categoria</CardTitle>
          <CardDescription>Nenhuma transação disponível para análise</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Distribuição de Receitas */}
      {incomeData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição de Receitas</CardTitle>
            <CardDescription>
              Top categorias • Total: {formatCurrency(getTotal(incomeData))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Gráfico de pizza menor */}
              <ChartContainer
                config={Object.fromEntries(
                  incomeData.map((item, index) => [
                    item.name,
                    {
                      label: item.name,
                      color: COLORS[index % COLORS.length],
                    },
                  ])
                )}
                className="h-[180px] w-full lg:w-[180px] flex-shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {incomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Lista de categorias */}
              <div className="flex-1 space-y-2">
                {incomeData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-medium text-xs">{formatCurrency(item.value)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        ({getPercentage(item.value, incomeData)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribuição de Despesas */}
      {expenseData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição de Despesas</CardTitle>
            <CardDescription>
              Top categorias • Total: {formatCurrency(getTotal(expenseData))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Gráfico de pizza menor */}
              <ChartContainer
                config={Object.fromEntries(
                  expenseData.map((item, index) => [
                    item.name,
                    {
                      label: item.name,
                      color: COLORS[index % COLORS.length],
                    },
                  ])
                )}
                className="h-[180px] w-full lg:w-[180px] flex-shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Lista de categorias */}
              <div className="flex-1 space-y-2">
                {expenseData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-medium text-xs">{formatCurrency(item.value)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        ({getPercentage(item.value, expenseData)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
