import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Brain, Calendar, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function FinanceiroPrevisoes() {
  const [periodoPrevisao, setPeriodoPrevisao] = useState('6');

  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ['fin-lancamentos-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .is('deleted_at', null)
        .order('data_vencimento', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: recorrencias } = useQuery({
    queryKey: ['fin-recorrencias-previsao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_recorrencias')
        .select('*')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
  });

  // Análise de dados históricos para previsões
  const analiseHistorica = useMemo(() => {
    if (!lancamentos) return null;

    const hoje = new Date();
    const mesesAtras = 12;
    
    // Agrupar por mês
    const dadosPorMes: Record<string, { receitas: number; despesas: number; count: number }> = {};
    
    lancamentos.forEach((l) => {
      const data = new Date(l.data_vencimento);
      const diffMeses = (hoje.getFullYear() - data.getFullYear()) * 12 + (hoje.getMonth() - data.getMonth());
      
      if (diffMeses >= 0 && diffMeses < mesesAtras) {
        const chave = format(data, 'yyyy-MM');
        if (!dadosPorMes[chave]) {
          dadosPorMes[chave] = { receitas: 0, despesas: 0, count: 0 };
        }
        if (l.tipo === 'receita' && l.status === 'pago') {
          dadosPorMes[chave].receitas += Number(l.valor);
        } else if (l.tipo === 'despesa' && l.status === 'pago') {
          dadosPorMes[chave].despesas += Number(l.valor);
        }
        dadosPorMes[chave].count++;
      }
    });

    const meses = Object.keys(dadosPorMes).sort();
    const mediaReceitas = meses.length > 0 
      ? meses.reduce((acc, m) => acc + dadosPorMes[m].receitas, 0) / meses.length 
      : 0;
    const mediaDespesas = meses.length > 0 
      ? meses.reduce((acc, m) => acc + dadosPorMes[m].despesas, 0) / meses.length 
      : 0;

    // Calcular tendência (regressão linear simples)
    let tendenciaReceitas = 0;
    let tendenciaDespesas = 0;
    
    if (meses.length >= 3) {
      const n = meses.length;
      const ultimosMeses = meses.slice(-6);
      
      let somaX = 0, somaYR = 0, somaYD = 0, somaXY_R = 0, somaXY_D = 0, somaX2 = 0;
      ultimosMeses.forEach((m, i) => {
        somaX += i;
        somaYR += dadosPorMes[m].receitas;
        somaYD += dadosPorMes[m].despesas;
        somaXY_R += i * dadosPorMes[m].receitas;
        somaXY_D += i * dadosPorMes[m].despesas;
        somaX2 += i * i;
      });
      
      const nn = ultimosMeses.length;
      const denominador = nn * somaX2 - somaX * somaX;
      if (denominador !== 0) {
        tendenciaReceitas = (nn * somaXY_R - somaX * somaYR) / denominador;
        tendenciaDespesas = (nn * somaXY_D - somaX * somaYD) / denominador;
      }
    }

    return {
      dadosPorMes,
      meses,
      mediaReceitas,
      mediaDespesas,
      tendenciaReceitas,
      tendenciaDespesas,
    };
  }, [lancamentos]);

  // Gerar previsões para os próximos meses
  const previsoes = useMemo(() => {
    if (!analiseHistorica) return [];

    const { mediaReceitas, mediaDespesas, tendenciaReceitas, tendenciaDespesas, meses } = analiseHistorica;
    const numMeses = parseInt(periodoPrevisao);
    const hoje = new Date();
    const resultado = [];

    // Adicionar dados históricos
    meses.slice(-6).forEach((m) => {
      const dados = analiseHistorica.dadosPorMes[m];
      resultado.push({
        mes: format(new Date(m + '-01'), 'MMM/yy', { locale: ptBR }),
        receitas: dados.receitas,
        despesas: dados.despesas,
        saldo: dados.receitas - dados.despesas,
        tipo: 'historico',
      });
    });

    // Adicionar recorrências futuras
    let recorrentesReceitas = 0;
    let recorrentesDespesas = 0;
    
    recorrencias?.forEach((r) => {
      const valorMensal = r.frequencia === 'mensal' 
        ? Number(r.valor)
        : r.frequencia === 'semanal' 
          ? Number(r.valor) * 4.33
          : r.frequencia === 'anual'
            ? Number(r.valor) / 12
            : Number(r.valor);
      
      if (r.tipo === 'receita') {
        recorrentesReceitas += valorMensal;
      } else {
        recorrentesDespesas += valorMensal;
      }
    });

    // Gerar previsões
    for (let i = 1; i <= numMeses; i++) {
      const mesFuturo = addMonths(hoje, i);
      
      // Aplicar tendência + sazonalidade simplificada
      const fatorSazonal = 1 + Math.sin((mesFuturo.getMonth() - 6) * Math.PI / 6) * 0.1;
      
      const receitaPrevista = Math.max(0, (mediaReceitas + tendenciaReceitas * i) * fatorSazonal + recorrentesReceitas);
      const despesaPrevista = Math.max(0, (mediaDespesas + tendenciaDespesas * i) * fatorSazonal + recorrentesDespesas);
      
      resultado.push({
        mes: format(mesFuturo, 'MMM/yy', { locale: ptBR }),
        receitas: receitaPrevista,
        despesas: despesaPrevista,
        saldo: receitaPrevista - despesaPrevista,
        tipo: 'previsao',
        confianca: Math.max(50, 95 - i * 5), // Confiança diminui com o tempo
      });
    }

    return resultado;
  }, [analiseHistorica, periodoPrevisao, recorrencias]);

  // Insights de IA
  const insights = useMemo(() => {
    if (!analiseHistorica || !previsoes.length) return [];

    const { tendenciaReceitas, tendenciaDespesas, mediaReceitas, mediaDespesas } = analiseHistorica;
    const resultados = [];

    // Análise de tendência de receitas
    if (tendenciaReceitas > mediaReceitas * 0.02) {
      resultados.push({
        tipo: 'positivo',
        titulo: 'Receitas em crescimento',
        descricao: `Suas receitas estão crescendo em média ${formatCurrency(tendenciaReceitas)} por mês.`,
        icone: TrendingUp,
      });
    } else if (tendenciaReceitas < -mediaReceitas * 0.02) {
      resultados.push({
        tipo: 'alerta',
        titulo: 'Queda nas receitas',
        descricao: `Suas receitas estão diminuindo em média ${formatCurrency(Math.abs(tendenciaReceitas))} por mês.`,
        icone: TrendingDown,
      });
    }

    // Análise de tendência de despesas
    if (tendenciaDespesas > mediaDespesas * 0.03) {
      resultados.push({
        tipo: 'alerta',
        titulo: 'Despesas aumentando',
        descricao: `Suas despesas estão crescendo em média ${formatCurrency(tendenciaDespesas)} por mês. Considere revisar gastos.`,
        icone: AlertTriangle,
      });
    }

    // Análise de margem
    const margemMedia = mediaReceitas > 0 ? ((mediaReceitas - mediaDespesas) / mediaReceitas) * 100 : 0;
    if (margemMedia > 20) {
      resultados.push({
        tipo: 'positivo',
        titulo: 'Margem saudável',
        descricao: `Sua margem média é de ${margemMedia.toFixed(1)}%. Continue assim!`,
        icone: TrendingUp,
      });
    } else if (margemMedia < 10 && margemMedia > 0) {
      resultados.push({
        tipo: 'alerta',
        titulo: 'Margem apertada',
        descricao: `Sua margem média é de apenas ${margemMedia.toFixed(1)}%. Considere aumentar receitas ou reduzir custos.`,
        icone: AlertTriangle,
      });
    }

    // Previsão de fluxo negativo
    const previsoesFuturas = previsoes.filter(p => p.tipo === 'previsao');
    const mesesNegativos = previsoesFuturas.filter(p => p.saldo < 0);
    if (mesesNegativos.length > 0) {
      resultados.push({
        tipo: 'alerta',
        titulo: 'Atenção ao fluxo de caixa',
        descricao: `Previsão de ${mesesNegativos.length} mês(es) com saldo negativo nos próximos ${periodoPrevisao} meses.`,
        icone: AlertTriangle,
      });
    }

    return resultados;
  }, [analiseHistorica, previsoes, periodoPrevisao]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Carregando análises...</div>;
  }

  const totalReceitaPrevista = previsoes
    .filter(p => p.tipo === 'previsao')
    .reduce((acc, p) => acc + p.receitas, 0);
  
  const totalDespesaPrevista = previsoes
    .filter(p => p.tipo === 'previsao')
    .reduce((acc, p) => acc + p.despesas, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Previsões Inteligentes</h3>
          <Badge variant="outline" className="bg-primary/10">
            <Sparkles className="h-3 w-3 mr-1" />
            IA
          </Badge>
        </div>
        <Select value={periodoPrevisao} onValueChange={setPeriodoPrevisao}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Próximos 3 meses</SelectItem>
            <SelectItem value="6">Próximos 6 meses</SelectItem>
            <SelectItem value="12">Próximos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Prevista ({periodoPrevisao}m)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalReceitaPrevista)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {formatCurrency(totalReceitaPrevista / parseInt(periodoPrevisao))}/mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesa Prevista ({periodoPrevisao}m)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalDespesaPrevista)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {formatCurrency(totalDespesaPrevista / parseInt(periodoPrevisao))}/mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Previsto ({periodoPrevisao}m)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalReceitaPrevista - totalDespesaPrevista >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalReceitaPrevista - totalDespesaPrevista)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {totalReceitaPrevista > 0 ? (((totalReceitaPrevista - totalDespesaPrevista) / totalReceitaPrevista) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights de IA */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Insights da IA
            </CardTitle>
            <CardDescription>Análises automáticas baseadas nos seus dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    insight.tipo === 'positivo' 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                      : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <insight.icone className={`h-5 w-5 mt-0.5 ${
                      insight.tipo === 'positivo' ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                    <div>
                      <h4 className="font-medium">{insight.titulo}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de previsão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projeção de Fluxo de Caixa</CardTitle>
          <CardDescription>Histórico + previsão para os próximos {periodoPrevisao} meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={previsoes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Legend />
                <defs>
                  <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="receitas" 
                  name="Receitas"
                  stroke="#22c55e" 
                  fillOpacity={1}
                  fill="url(#colorReceitas)"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="despesas" 
                  name="Despesas"
                  stroke="#ef4444" 
                  fillOpacity={1}
                  fill="url(#colorDespesas)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500" />
              <span>Histórico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500 border-dashed border-b-2" style={{ borderStyle: 'dashed' }} />
              <span>Previsão</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de previsões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Mês</th>
                  <th className="text-right py-2 px-4">Receitas</th>
                  <th className="text-right py-2 px-4">Despesas</th>
                  <th className="text-right py-2 px-4">Saldo</th>
                  <th className="text-center py-2 px-4">Tipo</th>
                  <th className="text-center py-2 px-4">Confiança</th>
                </tr>
              </thead>
              <tbody>
                {previsoes.map((p, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-4 font-medium">{p.mes}</td>
                    <td className="py-2 px-4 text-right text-green-600">{formatCurrency(p.receitas)}</td>
                    <td className="py-2 px-4 text-right text-red-600">{formatCurrency(p.despesas)}</td>
                    <td className={`py-2 px-4 text-right font-medium ${p.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(p.saldo)}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <Badge variant={p.tipo === 'historico' ? 'secondary' : 'outline'}>
                        {p.tipo === 'historico' ? 'Histórico' : 'Previsão'}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-center">
                      {p.tipo === 'previsao' && p.confianca && (
                        <Badge variant="outline" className={
                          p.confianca >= 80 ? 'bg-green-100 text-green-700' :
                          p.confianca >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {p.confianca}%
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
