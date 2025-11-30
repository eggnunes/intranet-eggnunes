import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

const STORAGE_KEY = 'relatorios_financeiros_cache';

export default function RelatoriosFinanceiros() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [rateLimitError, setRateLimitError] = useState(false);
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    // Load cached transactions first
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const { transactions: cachedTransactions, timestamp } = JSON.parse(cached);
        setTransactions(cachedTransactions);
        setLastUpdate(new Date(timestamp));
      } catch (error) {
        console.error('Error loading cached transactions:', error);
      }
    }
    fetchTransactions();
  }, []);

  const fetchTransactions = async (forceRefresh = false) => {
    setLoading(true);
    setRateLimitError(false);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/transactions', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      // Ensure we always have an array
      const transactionsData = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      
      // Check if we got rate limited but have cached data
      if (data?.metadata?.rateLimited && transactionsData.length === 0) {
        setRateLimitError(true);
        // Keep existing cached transactions
        return;
      }
      
      if (transactionsData.length > 0) {
        setTransactions(transactionsData);
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          transactions: transactionsData,
          timestamp: new Date().toISOString()
        }));
      }
      
      setMetadata(data?.metadata);
      setLastUpdate(new Date());
      
      if (data?.metadata?.rateLimited) {
        setRateLimitError(true);
      }

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'Os relatórios foram recarregados.',
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setRateLimitError(true);
      toast({
        title: 'Erro ao carregar transações',
        description: 'Não foi possível carregar as transações financeiras. Mostrando dados em cache.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransactions = () => {
    if (!Array.isArray(transactions)) return [];
    if (periodFilter === 'all') return transactions;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        return transactions;
    }

    return transactions.filter((t) => {
      const transactionDate = parseISO(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  const totalIncome = Array.isArray(filteredTransactions)
    ? filteredTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const totalExpense = Array.isArray(filteredTransactions)
    ? filteredTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const balance = totalIncome - totalExpense;

  const getChartData = () => {
    if (!Array.isArray(filteredTransactions) || filteredTransactions.length === 0) return [];

    const monthlyData: Record<string, { month: string; receitas: number; despesas: number }> = {};

    filteredTransactions.forEach((transaction) => {
      const date = parseISO(transaction.date);
      const monthKey = format(date, 'MM/yyyy', { locale: ptBR });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, receitas: 0, despesas: 0 };
      }

      if (transaction.type === 'income') {
        monthlyData[monthKey].receitas += transaction.amount;
      } else {
        monthlyData[monthKey].despesas += transaction.amount;
      }
    });

    return Object.values(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.month.split('/');
      const [monthB, yearB] = b.month.split('/');
      return new Date(parseInt(yearA), parseInt(monthA) - 1).getTime() - 
             new Date(parseInt(yearB), parseInt(monthB) - 1).getTime();
    });
  };

  const chartData = getChartData();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Verificando permissões...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Esta página é acessível apenas para administradores.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando relatórios...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              Relatórios Financeiros
            </h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe suas transações e relatórios financeiros
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {rateLimitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limite de requisições atingido</AlertTitle>
            <AlertDescription>
              Não foi possível atualizar os dados do Advbox devido ao limite de requisições da API. 
              Os dados exibidos são do último cache disponível. Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        )}

        {/* Filtros de Período */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período para visualização</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <label className="text-sm font-medium">Período:</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="quarter">Trimestre atual</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Evolução */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evolução Temporal</CardTitle>
              <CardDescription>Receitas e despesas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
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
                className="h-[400px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                      formatter={(value: number) => 
                        new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(value)
                      }
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="receitas" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="despesas" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalIncome)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpense)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transação' : 'transações'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {transaction.type === 'income' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <p className="font-semibold">{transaction.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.category}
                              </Badge>
                            </div>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
