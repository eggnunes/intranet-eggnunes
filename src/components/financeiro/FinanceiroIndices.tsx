import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Percent, DollarSign, PieChart, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface DadosMensais {
  mes: string;
  receita: number;
  despesa: number;
  lucro: number;
  margemLiquida: number;
}

export function FinanceiroIndices() {
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dadosMensais, setDadosMensais] = useState<DadosMensais[]>([]);
  const [indices, setIndices] = useState({
    margemLiquida: 0,
    margemBruta: 0,
    roi: 0,
    indiceLucratividade: 0,
    ticketMedio: 0,
    custoOperacional: 0,
    crescimentoReceita: 0,
    crescimentoDespesa: 0
  });

  useEffect(() => {
    fetchDados();
  }, [ano]);

  async function fetchDados() {
    setLoading(true);

    const startDate = `${ano}-01-01`;
    const endDate = `${ano}-12-31`;

    const { data: lancamentos } = await supabase
      .from('fin_lancamentos')
      .select('tipo, valor, data_vencimento, status, cliente_id')
      .gte('data_vencimento', startDate)
      .lte('data_vencimento', endDate)
      .eq('status', 'pago')
      .is('deleted_at', null);

    // Dados do ano anterior para comparação
    const { data: lancamentosAnoAnterior } = await supabase
      .from('fin_lancamentos')
      .select('tipo, valor')
      .gte('data_vencimento', `${ano - 1}-01-01`)
      .lte('data_vencimento', `${ano - 1}-12-31`)
      .eq('status', 'pago')
      .is('deleted_at', null);

    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Processar dados mensais
    const dadosPorMes: DadosMensais[] = meses.map((mes, index) => {
      const mesNum = index + 1;
      const lancamentosMes = (lancamentos || []).filter(l => {
        const data = new Date(l.data_vencimento);
        return data.getMonth() + 1 === mesNum;
      });

      const receita = lancamentosMes.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + Number(l.valor), 0);
      const despesa = lancamentosMes.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + Number(l.valor), 0);
      const lucro = receita - despesa;
      const margemLiquida = receita > 0 ? (lucro / receita) * 100 : 0;

      return { mes, receita, despesa, lucro, margemLiquida };
    });

    setDadosMensais(dadosPorMes);

    // Calcular índices anuais
    const receitaTotal = (lancamentos || []).filter(l => l.tipo === 'receita').reduce((sum, l) => sum + Number(l.valor), 0);
    const despesaTotal = (lancamentos || []).filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + Number(l.valor), 0);
    const lucroTotal = receitaTotal - despesaTotal;

    const receitaAnoAnterior = (lancamentosAnoAnterior || []).filter(l => l.tipo === 'receita').reduce((sum, l) => sum + Number(l.valor), 0);
    const despesaAnoAnterior = (lancamentosAnoAnterior || []).filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + Number(l.valor), 0);

    // Clientes únicos
    const clientesUnicos = new Set((lancamentos || []).filter(l => l.cliente_id).map(l => l.cliente_id));
    const ticketMedio = clientesUnicos.size > 0 ? receitaTotal / clientesUnicos.size : 0;

    setIndices({
      margemLiquida: receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0,
      margemBruta: receitaTotal > 0 ? ((receitaTotal - despesaTotal * 0.7) / receitaTotal) * 100 : 0,
      roi: despesaTotal > 0 ? ((lucroTotal / despesaTotal) * 100) : 0,
      indiceLucratividade: receitaTotal > 0 ? (lucroTotal / receitaTotal) : 0,
      ticketMedio,
      custoOperacional: receitaTotal > 0 ? (despesaTotal / receitaTotal) * 100 : 0,
      crescimentoReceita: receitaAnoAnterior > 0 ? ((receitaTotal - receitaAnoAnterior) / receitaAnoAnterior) * 100 : 0,
      crescimentoDespesa: despesaAnoAnterior > 0 ? ((despesaTotal - despesaAnoAnterior) / despesaAnoAnterior) * 100 : 0
    });

    setLoading(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
  }

  function getHealthStatus() {
    if (indices.margemLiquida >= 20 && indices.roi >= 50) return { status: 'Excelente', color: 'bg-green-500', icon: CheckCircle };
    if (indices.margemLiquida >= 10 && indices.roi >= 20) return { status: 'Saudável', color: 'bg-blue-500', icon: CheckCircle };
    if (indices.margemLiquida >= 5) return { status: 'Atenção', color: 'bg-yellow-500', icon: AlertTriangle };
    return { status: 'Crítico', color: 'bg-red-500', icon: AlertTriangle };
  }

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Índices Financeiros</h2>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(a => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status de Saúde Financeira */}
      <Card className={`border-2 ${healthStatus.color.replace('bg-', 'border-')}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HealthIcon className={`h-5 w-5 ${healthStatus.color.replace('bg-', 'text-')}`} />
            Saúde Financeira: {healthStatus.status}
          </CardTitle>
          <CardDescription>
            Análise geral da situação financeira do escritório em {ano}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Margem Líquida</p>
              <p className={`text-xl font-bold ${indices.margemLiquida >= 10 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(indices.margemLiquida)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ROI</p>
              <p className={`text-xl font-bold ${indices.roi >= 20 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(indices.roi)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cresc. Receita</p>
              <p className={`text-xl font-bold ${indices.crescimentoReceita >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(indices.crescimentoReceita)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Custo Operacional</p>
              <p className={`text-xl font-bold ${indices.custoOperacional <= 70 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(indices.custoOperacional)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Índices */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Líquida</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(indices.margemLiquida)}</div>
            <p className="text-xs text-muted-foreground">Lucro / Receita Total</p>
            <Progress value={Math.min(100, indices.margemLiquida)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(indices.roi)}</div>
            <p className="text-xs text-muted-foreground">Retorno sobre Investimento</p>
            <Progress value={Math.min(100, indices.roi)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(indices.ticketMedio)}</div>
            <p className="text-xs text-muted-foreground">Por cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Lucratividade</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indices.indiceLucratividade.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Lucro por real de receita</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Margem Líquida Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Margem Líquida</CardTitle>
          <CardDescription>Margem líquida mês a mês em {ano}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dadosMensais}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Area type="monotone" dataKey="margemLiquida" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Margem Líquida %" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Análise de Sazonalidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Análise de Sazonalidade
          </CardTitle>
          <CardDescription>Identificação de padrões mensais de receita</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosMensais}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="hsl(var(--chart-1))" name="Receita" strokeWidth={2} />
              <Line type="monotone" dataKey="despesa" stroke="hsl(var(--destructive))" name="Despesa" strokeWidth={2} />
              <Line type="monotone" dataKey="lucro" stroke="hsl(var(--chart-2))" name="Lucro" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>

          {/* Insights de Sazonalidade */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {(() => {
              const melhorMes = [...dadosMensais].sort((a, b) => b.receita - a.receita)[0];
              const piorMes = [...dadosMensais].filter(m => m.receita > 0).sort((a, b) => a.receita - b.receita)[0];
              const mediaReceita = dadosMensais.reduce((sum, m) => sum + m.receita, 0) / dadosMensais.filter(m => m.receita > 0).length || 0;

              return (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Melhor Mês</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{melhorMes?.mes || '-'}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(melhorMes?.receita || 0)}</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Pior Mês</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{piorMes?.mes || '-'}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(piorMes?.receita || 0)}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Média Mensal</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(mediaReceita)}</p>
                    <p className="text-sm text-muted-foreground">Receita média</p>
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Comparativo de Crescimento */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {indices.crescimentoReceita >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              Crescimento de Receita
            </CardTitle>
            <CardDescription>Comparado ao ano anterior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${indices.crescimentoReceita >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {indices.crescimentoReceita >= 0 ? '+' : ''}{formatPercent(indices.crescimentoReceita)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {indices.crescimentoDespesa <= 0 ? (
                <TrendingDown className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingUp className="h-5 w-5 text-red-500" />
              )}
              Variação de Despesas
            </CardTitle>
            <CardDescription>Comparado ao ano anterior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${indices.crescimentoDespesa <= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {indices.crescimentoDespesa >= 0 ? '+' : ''}{formatPercent(indices.crescimentoDespesa)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
