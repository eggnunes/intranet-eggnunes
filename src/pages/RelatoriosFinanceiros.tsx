import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield, Download, FileSpreadsheet, FileText, Percent, Receipt, Activity, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO, subMonths, subQuarters, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialAlerts } from '@/components/FinancialAlerts';
import { FinancialPredictions } from '@/components/FinancialPredictions';
import { FinancialDistribution } from '@/components/FinancialDistribution';
import { CashFlowProjection } from '@/components/CashFlowProjection';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { FinancialDefaulters } from '@/components/FinancialDefaulters';
import { Link } from 'react-router-dom';

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

  // Carregar cache imediatamente antes do componente montar
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { transactions: cachedTransactions, timestamp } = JSON.parse(cached);
        return { transactions: cachedTransactions, timestamp: new Date(timestamp) };
      }
    } catch (error) {
      console.error('Error loading cached transactions:', error);
    }
    return null;
  };

  const cachedData = loadFromCache();

  useEffect(() => {
    // Aplicar cache imediatamente se existir
    if (cachedData && transactions.length === 0) {
      setTransactions(cachedData.transactions);
      setLastUpdate(cachedData.timestamp);
      setLoading(false);
    }
    // Buscar dados atualizados em background
    fetchTransactions();
  }, []);

  const fetchTransactions = async (forceRefresh = false) => {
    // Só mostrar loading se não tem dados em cache
    if (transactions.length === 0) {
      setLoading(true);
    }
    setRateLimitError(false);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/transactions', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      // A resposta vem como: { data: { data: { data: [...], offset, limit, totalCount } } }
      const apiResponse = data?.data || data;
      const transactionsData = apiResponse?.data || [];
      
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
      if (!t.date) return false;
      try {
        const transactionDate = parseISO(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      } catch {
        return false;
      }
    });
  };

  const getPreviousPeriodTransactions = () => {
    if (!Array.isArray(transactions) || periodFilter === 'all') return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case 'month':
        const prevMonth = subMonths(now, 1);
        startDate = startOfMonth(prevMonth);
        endDate = endOfMonth(prevMonth);
        break;
      case 'quarter':
        const prevQuarter = subQuarters(now, 1);
        startDate = startOfQuarter(prevQuarter);
        endDate = endOfQuarter(prevQuarter);
        break;
      case 'year':
        const prevYear = subYears(now, 1);
        startDate = startOfYear(prevYear);
        endDate = endOfYear(prevYear);
        break;
      default:
        return [];
    }

    return transactions.filter((t) => {
      if (!t.date) return false;
      try {
        const transactionDate = parseISO(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      } catch {
        return false;
      }
    });
  };

  const filteredTransactions = getFilteredTransactions();
  const previousPeriodTransactions = getPreviousPeriodTransactions();

  // Filtrar apenas transações com datas válidas para exibição
  const validFilteredTransactions = filteredTransactions.filter(t => {
    if (!t.date) return false;
    try {
      const date = new Date(t.date);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  });

  const totalIncome = Array.isArray(filteredTransactions)
    ? filteredTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const totalExpense = Array.isArray(filteredTransactions)
    ? filteredTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const balance = totalIncome - totalExpense;

  // Métricas avançadas
  const profitMargin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const averageTicket = filteredTransactions.filter((t) => t.type === 'income').length > 0 
    ? totalIncome / filteredTransactions.filter((t) => t.type === 'income').length 
    : 0;

  // Taxa de crescimento em relação ao período anterior
  const prevIncome = Array.isArray(previousPeriodTransactions)
    ? previousPeriodTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    : 0;
  const growthRate = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0;

  const getChartData = () => {
    if (!Array.isArray(validFilteredTransactions) || validFilteredTransactions.length === 0) return [];

    const monthlyData: Record<string, { month: string; receitas: number; despesas: number }> = {};

    validFilteredTransactions.forEach((transaction) => {
      try {
        const date = new Date(transaction.date);
        const monthKey = format(date, 'MM/yyyy', { locale: ptBR });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, receitas: 0, despesas: 0 };
        }

        if (transaction.type === 'income') {
          monthlyData[monthKey].receitas += transaction.amount;
        } else {
          monthlyData[monthKey].despesas += transaction.amount;
        }
      } catch (error) {
        console.error('Erro ao processar transação:', transaction, error);
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

  const exportToExcel = () => {
    const worksheetData = validFilteredTransactions
      .map((t) => ({
        Data: format(new Date(t.date), 'dd/MM/yyyy', { locale: ptBR }),
        Descrição: t.description,
        Categoria: t.category,
        Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
        Valor: t.amount,
      }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transações');

    // Adicionar resumo
    const summaryData = [
      { Métrica: 'Total de Receitas', Valor: totalIncome },
      { Métrica: 'Total de Despesas', Valor: totalExpense },
      { Métrica: 'Saldo', Valor: balance },
      { Métrica: 'Margem de Lucro (%)', Valor: profitMargin.toFixed(2) },
      { Métrica: 'Ticket Médio', Valor: averageTicket },
      { Métrica: 'Taxa de Crescimento (%)', Valor: growthRate.toFixed(2) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    const periodLabel = periodFilter === 'all' ? 'Completo' : 
                       periodFilter === 'month' ? 'Mensal' :
                       periodFilter === 'quarter' ? 'Trimestral' : 'Anual';
    XLSX.writeFile(workbook, `Relatorio_Financeiro_${periodLabel}_${format(new Date(), 'ddMMyyyy')}.xlsx`);

    toast({
      title: 'Exportado com sucesso',
      description: 'Relatório exportado para Excel.',
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Relatório Financeiro', 14, 20);
    
    // Período
    const periodLabel = periodFilter === 'all' ? 'Completo' : 
                       periodFilter === 'month' ? 'Mês Atual' :
                       periodFilter === 'quarter' ? 'Trimestre Atual' : 'Ano Atual';
    doc.setFontSize(12);
    doc.text(`Período: ${periodLabel}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 37);

    // Métricas
    doc.setFontSize(14);
    doc.text('Resumo Executivo', 14, 50);
    
    const metricsData = [
      ['Métrica', 'Valor'],
      ['Total de Receitas', formatCurrency(totalIncome)],
      ['Total de Despesas', formatCurrency(totalExpense)],
      ['Saldo', formatCurrency(balance)],
      ['Margem de Lucro', `${profitMargin.toFixed(2)}%`],
      ['Ticket Médio', formatCurrency(averageTicket)],
      ['Taxa de Crescimento', `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)}%`],
    ];

    autoTable(doc, {
      startY: 55,
      head: [metricsData[0]],
      body: metricsData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Transações
    doc.setFontSize(14);
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.text('Transações', 14, finalY + 10);

    const transactionsData = validFilteredTransactions
      .map((t) => [
        format(new Date(t.date), 'dd/MM/yyyy'),
        t.description,
        t.category,
        t.type === 'income' ? 'Receita' : 'Despesa',
        formatCurrency(t.amount),
      ]);

    autoTable(doc, {
      startY: finalY + 15,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
      body: transactionsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 60 },
        4: { halign: 'right' },
      },
    });

    doc.save(`Relatorio_Financeiro_${periodLabel}_${format(new Date(), 'ddMMyyyy')}.pdf`);

    toast({
      title: 'Exportado com sucesso',
      description: 'Relatório exportado para PDF.',
    });
  };

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
              Financeiro
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

        {filteredTransactions.length !== validFilteredTransactions.length && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Transações com datas inválidas</AlertTitle>
            <AlertDescription>
              {filteredTransactions.length - validFilteredTransactions.length} {filteredTransactions.length - validFilteredTransactions.length === 1 ? 'transação foi ignorada' : 'transações foram ignoradas'} por conter dados de data inválidos ou ausentes.
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

        {/* Dashboard Executivo com KPIs e Metas */}
        <ExecutiveDashboard
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          profitMargin={profitMargin}
          period={periodFilter}
        />

        {/* Sistema de Alertas */}
        <FinancialAlerts
          totalExpense={totalExpense}
          profitMargin={profitMargin}
          growthRate={growthRate}
          period={periodFilter}
        />

        {/* Inadimplentes */}
        <FinancialDefaulters transactions={filteredTransactions} />

        {/* Link para Gestão de Cobranças */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sistema de Gestão de Cobranças
            </CardTitle>
            <CardDescription>
              Acesse o dashboard completo de cobranças automáticas, histórico de mensagens e configuração de regras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/gestao-cobrancas">
              <Button className="w-full sm:w-auto">
                Acessar Gestão de Cobranças
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Fluxo de Caixa Projetado */}
        <CashFlowProjection transactions={filteredTransactions} />

        {/* Análise Preditiva */}
        <FinancialPredictions transactions={filteredTransactions} />

        {/* Gráficos de Distribuição por Categoria */}
        <FinancialDistribution transactions={filteredTransactions} />

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

        {/* Dashboard de Métricas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Indicadores de Performance</CardTitle>
                <CardDescription>Métricas financeiras detalhadas do período selecionado</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToExcel} variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Margem de Lucro */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4 text-primary" />
                    Margem de Lucro
                  </CardTitle>
                  <CardDescription>Rentabilidade das operações</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profitMargin.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {profitMargin >= 20 ? 'Excelente' : profitMargin >= 10 ? 'Boa' : profitMargin >= 0 ? 'Razoável' : 'Atenção necessária'}
                  </p>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Ticket Médio
                  </CardTitle>
                  <CardDescription>Valor médio por receita</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(averageTicket)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filteredTransactions.filter((t) => t.type === 'income').length} transações de receita
                  </p>
                </CardContent>
              </Card>

              {/* Taxa de Crescimento */}
              <Card className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Taxa de Crescimento
                  </CardTitle>
                  <CardDescription>
                    {periodFilter === 'month' ? 'vs. mês anterior' :
                     periodFilter === 'quarter' ? 'vs. trimestre anterior' :
                     periodFilter === 'year' ? 'vs. ano anterior' : 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold flex items-center gap-2 ${
                    growthRate > 0 ? 'text-green-600' : growthRate < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {growthRate > 0 && <TrendingUp className="h-6 w-6" />}
                    {growthRate < 0 && <TrendingDown className="h-6 w-6" />}
                    {growthRate > 0 ? '+' : ''}{growthRate.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {periodFilter === 'all' ? 'Selecione um período específico' :
                     growthRate > 10 ? 'Crescimento forte' :
                     growthRate > 0 ? 'Crescimento moderado' :
                     growthRate === 0 ? 'Estável' : 'Declínio'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {validFilteredTransactions.length} {validFilteredTransactions.length === 1 ? 'transação' : 'transações'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {validFilteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validFilteredTransactions.map((transaction) => (
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
