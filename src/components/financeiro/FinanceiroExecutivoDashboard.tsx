import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle,
  RefreshCw,
  AlertCircle,
  Calendar,
  Target,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend, ComposedChart, Line 
} from 'recharts';

interface DashboardData {
  totalReceitas: number;
  totalDespesas: number;
  lucro: number;
  margemLucro: number;
  contasSaldo: { nome: string; saldo: number; cor: string }[];
  despesasReembolsar: number;
  receitasPorCategoria: { nome: string; valor: number; cor: string }[];
  despesasPorCategoria: { nome: string; valor: number; cor: string }[];
  evolucaoMensal: { mes: string; receitas: number; despesas: number; lucro: number }[];
  comparativo: {
    receitasMesAtual: number;
    receitasMesAnterior: number;
    despesasMesAtual: number;
    despesasMesAnterior: number;
    variacaoReceitas: number;
    variacaoDespesas: number;
    variacaoLucro: number;
  };
  tendencias: {
    mediaReceitas3m: number;
    mediaDespesas3m: number;
    tendenciaReceitas: 'up' | 'down' | 'stable';
    tendenciaDespesas: 'up' | 'down' | 'stable';
  };
}

export function FinanceiroExecutivoDashboard() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    totalReceitas: 0,
    totalDespesas: 0,
    lucro: 0,
    margemLucro: 0,
    contasSaldo: [],
    despesasReembolsar: 0,
    receitasPorCategoria: [],
    despesasPorCategoria: [],
    evolucaoMensal: [],
    comparativo: {
      receitasMesAtual: 0,
      receitasMesAnterior: 0,
      despesasMesAtual: 0,
      despesasMesAnterior: 0,
      variacaoReceitas: 0,
      variacaoDespesas: 0,
      variacaoLucro: 0
    },
    tendencias: {
      mediaReceitas3m: 0,
      mediaDespesas3m: 0,
      tendenciaReceitas: 'stable',
      tendenciaDespesas: 'stable'
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const mesAtualInicio = startOfMonth(hoje);
      const mesAtualFim = endOfMonth(hoje);
      const mesAnteriorInicio = startOfMonth(subMonths(hoje, 1));
      const mesAnteriorFim = endOfMonth(subMonths(hoje, 1));

      // Determinar período selecionado
      let dataInicio: Date;
      let dataFim: Date;

      switch (periodo) {
        case 'mes_atual':
          dataInicio = mesAtualInicio;
          dataFim = mesAtualFim;
          break;
        case 'mes_anterior':
          dataInicio = mesAnteriorInicio;
          dataFim = mesAnteriorFim;
          break;
        case 'trimestre':
          dataInicio = startOfMonth(subMonths(hoje, 2));
          dataFim = mesAtualFim;
          break;
        case 'ano':
          dataInicio = startOfYear(hoje);
          dataFim = endOfYear(hoje);
          break;
        default:
          dataInicio = mesAtualInicio;
          dataFim = mesAtualFim;
      }

      // Fetch contas
      const { data: contas } = await supabase
        .from('fin_contas')
        .select('*')
        .eq('ativa', true);

      // Fetch lançamentos do período
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select(`*, categoria:fin_categorias(nome, cor)`)
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Lançamentos mês atual
      const { data: lancMesAtual } = await supabase
        .from('fin_lancamentos')
        .select('tipo, valor')
        .gte('data_lancamento', format(mesAtualInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(mesAtualFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Lançamentos mês anterior
      const { data: lancMesAnterior } = await supabase
        .from('fin_lancamentos')
        .select('tipo, valor')
        .gte('data_lancamento', format(mesAnteriorInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(mesAnteriorFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Despesas a reembolsar
      const { data: reembolsos } = await supabase
        .from('fin_lancamentos')
        .select('valor')
        .eq('a_reembolsar', true)
        .eq('reembolsada', false)
        .is('deleted_at', null);

      // Calcular totais
      const totalReceitas = lancamentos?.filter(l => l.tipo === 'receita')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      
      const totalDespesas = lancamentos?.filter(l => l.tipo === 'despesa')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

      const lucro = totalReceitas - totalDespesas;
      const margemLucro = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;

      // Comparativo mês a mês
      const receitasMesAtual = lancMesAtual?.filter(l => l.tipo === 'receita')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      const despesasMesAtual = lancMesAtual?.filter(l => l.tipo === 'despesa')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      const receitasMesAnterior = lancMesAnterior?.filter(l => l.tipo === 'receita')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      const despesasMesAnterior = lancMesAnterior?.filter(l => l.tipo === 'despesa')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

      const variacaoReceitas = receitasMesAnterior > 0 
        ? ((receitasMesAtual - receitasMesAnterior) / receitasMesAnterior) * 100 
        : 0;
      const variacaoDespesas = despesasMesAnterior > 0 
        ? ((despesasMesAtual - despesasMesAnterior) / despesasMesAnterior) * 100 
        : 0;
      
      const lucroMesAtual = receitasMesAtual - despesasMesAtual;
      const lucroMesAnterior = receitasMesAnterior - despesasMesAnterior;
      const variacaoLucro = lucroMesAnterior !== 0 
        ? ((lucroMesAtual - lucroMesAnterior) / Math.abs(lucroMesAnterior)) * 100 
        : 0;

      // Saldo por conta
      const contasSaldo = contas?.map(c => ({
        nome: c.nome,
        saldo: Number(c.saldo_atual) || 0,
        cor: c.cor || '#3B82F6'
      })) || [];

      // Despesas a reembolsar
      const despesasReembolsar = reembolsos?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      // Receitas por categoria
      const receitasMap = new Map<string, { valor: number; cor: string }>();
      lancamentos?.filter(l => l.tipo === 'receita').forEach(l => {
        const nome = l.categoria?.nome || 'Sem categoria';
        const cor = l.categoria?.cor || '#10B981';
        const atual = receitasMap.get(nome) || { valor: 0, cor };
        receitasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
      });
      const receitasPorCategoria = Array.from(receitasMap.entries())
        .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
        .sort((a, b) => b.valor - a.valor);

      // Despesas por categoria
      const despesasMap = new Map<string, { valor: number; cor: string }>();
      lancamentos?.filter(l => l.tipo === 'despesa').forEach(l => {
        const nome = l.categoria?.nome || 'Sem categoria';
        const cor = l.categoria?.cor || '#EF4444';
        const atual = despesasMap.get(nome) || { valor: 0, cor };
        despesasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
      });
      const despesasPorCategoria = Array.from(despesasMap.entries())
        .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
        .sort((a, b) => b.valor - a.valor);

      // Evolução mensal (últimos 6 meses)
      const evolucaoMensal: { mes: string; receitas: number; despesas: number; lucro: number }[] = [];
      let somaReceitas3m = 0;
      let somaDespesas3m = 0;
      
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(hoje, i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = endOfMonth(mesData);
        
        const { data: mesLancamentos } = await supabase
          .from('fin_lancamentos')
          .select('tipo, valor')
          .gte('data_lancamento', format(mesInicio, 'yyyy-MM-dd'))
          .lte('data_lancamento', format(mesFim, 'yyyy-MM-dd'))
          .eq('status', 'pago')
          .is('deleted_at', null);

        const mesReceitas = mesLancamentos?.filter(l => l.tipo === 'receita')
          .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
        const mesDespesas = mesLancamentos?.filter(l => l.tipo === 'despesa')
          .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

        evolucaoMensal.push({
          mes: format(mesData, 'MMM/yy', { locale: ptBR }),
          receitas: mesReceitas,
          despesas: mesDespesas,
          lucro: mesReceitas - mesDespesas
        });

        // Últimos 3 meses para tendência
        if (i <= 2) {
          somaReceitas3m += mesReceitas;
          somaDespesas3m += mesDespesas;
        }
      }

      const mediaReceitas3m = somaReceitas3m / 3;
      const mediaDespesas3m = somaDespesas3m / 3;

      // Determinar tendências
      const ultimoMes = evolucaoMensal[evolucaoMensal.length - 1];
      const tendenciaReceitas: 'up' | 'down' | 'stable' = 
        ultimoMes.receitas > mediaReceitas3m * 1.05 ? 'up' :
        ultimoMes.receitas < mediaReceitas3m * 0.95 ? 'down' : 'stable';
      const tendenciaDespesas: 'up' | 'down' | 'stable' = 
        ultimoMes.despesas > mediaDespesas3m * 1.05 ? 'up' :
        ultimoMes.despesas < mediaDespesas3m * 0.95 ? 'down' : 'stable';

      setData({
        totalReceitas,
        totalDespesas,
        lucro,
        margemLucro,
        contasSaldo,
        despesasReembolsar,
        receitasPorCategoria,
        despesasPorCategoria,
        evolucaoMensal,
        comparativo: {
          receitasMesAtual,
          receitasMesAnterior,
          despesasMesAtual,
          despesasMesAnterior,
          variacaoReceitas,
          variacaoDespesas,
          variacaoLucro
        },
        tendencias: {
          mediaReceitas3m,
          mediaDespesas3m,
          tendenciaReceitas,
          tendenciaDespesas
        }
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  const getVariacaoIcon = (value: number, invertido = false) => {
    if (Math.abs(value) < 1) return <Minus className="h-4 w-4 text-gray-500" />;
    if (invertido) {
      return value > 0 
        ? <ArrowUp className="h-4 w-4 text-red-500" />
        : <ArrowDown className="h-4 w-4 text-green-500" />;
    }
    return value > 0 
      ? <ArrowUp className="h-4 w-4 text-green-500" />
      : <ArrowDown className="h-4 w-4 text-red-500" />;
  };

  const getTendenciaIcon = (tendencia: 'up' | 'down' | 'stable', invertido = false) => {
    if (tendencia === 'stable') return <Minus className="h-5 w-5 text-gray-500" />;
    if (invertido) {
      return tendencia === 'up' 
        ? <TrendingUp className="h-5 w-5 text-red-500" />
        : <TrendingDown className="h-5 w-5 text-green-500" />;
    }
    return tendencia === 'up' 
      ? <TrendingUp className="h-5 w-5 text-green-500" />
      : <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
            <SelectItem value="trimestre">Último Trimestre</SelectItem>
            <SelectItem value="ano">Ano Atual</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards principais com variação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.totalReceitas)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoReceitas)}
              <span className={`text-sm ${data.comparativo.variacaoReceitas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoReceitas)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.totalDespesas)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoDespesas, true)}
              <span className={`text-sm ${data.comparativo.variacaoDespesas <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoDespesas)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.lucro)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getVariacaoIcon(data.comparativo.variacaoLucro)}
              <span className={`text-sm ${data.comparativo.variacaoLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.comparativo.variacaoLucro)}
              </span>
              <span className="text-xs text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.margemLucro >= 20 ? 'text-green-600' : data.margemLucro >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.margemLucro.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.margemLucro >= 20 ? 'Excelente' : data.margemLucro >= 10 ? 'Bom' : 'Atenção necessária'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tendências e Saldo Total */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {getTendenciaIcon(data.tendencias.tendenciaReceitas)}
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.tendencias.mediaReceitas3m)}</p>
                <p className="text-xs text-muted-foreground">Média últimos 3 meses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {getTendenciaIcon(data.tendencias.tendenciaDespesas, true)}
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.tendencias.mediaDespesas3m)}</p>
                <p className="text-xs text-muted-foreground">Média últimos 3 meses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total em Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">
                  {formatCurrency(data.contasSaldo.reduce((acc, c) => acc + c.saldo, 0))}
                </p>
                <p className="text-xs text-muted-foreground">{data.contasSaldo.length} conta(s) ativa(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* A Reembolsar */}
      {data.despesasReembolsar > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Despesas a Reembolsar</p>
                  <p className="text-sm text-muted-foreground">Gastos com clientes ainda não reembolsados</p>
                </div>
              </div>
              <Badge className="bg-orange-500 text-lg px-4 py-2">
                {formatCurrency(data.despesasReembolsar)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolução Mensal com Lucro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução Financeira</CardTitle>
          <CardDescription>Receitas, Despesas e Lucro nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'lucro' ? 'Lucro' : name === 'receitas' ? 'Receitas' : 'Despesas']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="receitas" fill="#10B981" name="Receitas" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="despesas" fill="#EF4444" name="Despesas" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="lucro" stroke="#3B82F6" strokeWidth={3} name="Lucro" dot={{ fill: '#3B82F6' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Saldo por Conta e Top Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldo por Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.contasSaldo.map((conta) => (
                <div 
                  key={conta.nome}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderLeftColor: conta.cor, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" style={{ color: conta.cor }} />
                    <span className="font-medium">{conta.nome}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {formatCurrency(conta.saldo)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.despesasPorCategoria.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {data.despesasPorCategoria.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Receitas e Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.receitasPorCategoria.slice(0, 5).map((cat, index) => (
                <div key={cat.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" style={{ backgroundColor: cat.cor + '20', borderColor: cat.cor }}>
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{cat.nome}</span>
                  </div>
                  <span className="font-medium text-green-600">{formatCurrency(cat.valor)}</span>
                </div>
              ))}
              {data.receitasPorCategoria.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma receita no período</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.despesasPorCategoria.slice(0, 5).map((cat, index) => (
                <div key={cat.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" style={{ backgroundColor: cat.cor + '20', borderColor: cat.cor }}>
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{cat.nome}</span>
                  </div>
                  <span className="font-medium text-red-600">{formatCurrency(cat.valor)}</span>
                </div>
              ))}
              {data.despesasPorCategoria.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma despesa no período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
