import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  RefreshCw, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle
} from 'lucide-react';
import { format, addDays, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate, formatLocalDateWithWeekday } from '@/lib/dateUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface FluxoData {
  data: string;
  dataFormatada: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

export function FinanceiroFluxoCaixa() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30');
  const [fluxoData, setFluxoData] = useState<FluxoData[]>([]);
  const [resumo, setResumo] = useState({
    totalEntradas: 0,
    totalSaidas: 0,
    saldoInicial: 0,
    saldoFinal: 0,
    menorSaldo: 0,
    diasNegativos: 0
  });

  useEffect(() => {
    fetchFluxoCaixa();
  }, [periodo]);

  const fetchFluxoCaixa = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const dataInicio = format(hoje, 'yyyy-MM-dd');
      const dataFim = format(addDays(hoje, parseInt(periodo)), 'yyyy-MM-dd');

      // Buscar saldo atual das contas
      const { data: contas } = await supabase
        .from('fin_contas')
        .select('saldo_atual')
        .eq('ativa', true);
      
      const saldoInicial = contas?.reduce((acc, c) => acc + Number(c.saldo_atual || 0), 0) || 0;

      // Buscar lançamentos pendentes/agendados
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('tipo, valor, data_vencimento, data_lancamento, status')
        .or(`status.eq.pendente,status.eq.agendado`)
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim)
        .is('deleted_at', null)
        .order('data_vencimento');

      // Buscar recorrências ativas
      const { data: recorrencias } = await supabase
        .from('fin_recorrencias')
        .select('*')
        .eq('ativo', true)
        .gte('proxima_geracao', dataInicio)
        .lte('proxima_geracao', dataFim);

      // Gerar dados por dia
      const fluxoPorDia = new Map<string, { entradas: number; saidas: number }>();
      
      // Inicializar todos os dias
      for (let i = 0; i <= parseInt(periodo); i++) {
        const data = format(addDays(hoje, i), 'yyyy-MM-dd');
        fluxoPorDia.set(data, { entradas: 0, saidas: 0 });
      }

      // Adicionar lançamentos
      lancamentos?.forEach(l => {
        const data = l.data_vencimento || l.data_lancamento;
        if (data && fluxoPorDia.has(data)) {
          const atual = fluxoPorDia.get(data)!;
          if (l.tipo === 'receita') {
            atual.entradas += Number(l.valor);
          } else if (l.tipo === 'despesa') {
            atual.saidas += Number(l.valor);
          }
        }
      });

      // Adicionar recorrências
      recorrencias?.forEach(r => {
        if (r.proxima_geracao && fluxoPorDia.has(r.proxima_geracao)) {
          const atual = fluxoPorDia.get(r.proxima_geracao)!;
          if (r.tipo === 'receita') {
            atual.entradas += Number(r.valor);
          } else {
            atual.saidas += Number(r.valor);
          }
        }
      });

      // Converter para array e calcular saldo acumulado
      let saldoAcumulado = saldoInicial;
      const fluxoArray: FluxoData[] = [];
      let totalEntradas = 0;
      let totalSaidas = 0;
      let menorSaldo = saldoInicial;
      let diasNegativos = 0;

      Array.from(fluxoPorDia.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([data, valores]) => {
          const saldo = valores.entradas - valores.saidas;
          saldoAcumulado += saldo;
          
          totalEntradas += valores.entradas;
          totalSaidas += valores.saidas;
          
          if (saldoAcumulado < menorSaldo) {
            menorSaldo = saldoAcumulado;
          }
          
          if (saldoAcumulado < 0) {
            diasNegativos++;
          }

          fluxoArray.push({
            data,
            dataFormatada: formatLocalDate(data, 'dd/MM'),
            entradas: valores.entradas,
            saidas: valores.saidas,
            saldo,
            saldoAcumulado
          });
        });

      setFluxoData(fluxoArray);
      setResumo({
        totalEntradas,
        totalSaidas,
        saldoInicial,
        saldoFinal: saldoAcumulado,
        menorSaldo,
        diasNegativos
      });
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Próximos 7 dias</SelectItem>
              <SelectItem value="15">Próximos 15 dias</SelectItem>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="60">Próximos 60 dias</SelectItem>
              <SelectItem value="90">Próximos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchFluxoCaixa} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              Saldo Inicial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(resumo.saldoInicial)}</div>
            <p className="text-xs text-muted-foreground">Saldo atual das contas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Entradas Previstas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumo.totalEntradas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Saídas Previstas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(resumo.totalSaidas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-purple-500" />
              Saldo Final Previsto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resumo.saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(resumo.saldoFinal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {(resumo.menorSaldo < 0 || resumo.diasNegativos > 0) && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  Atenção: Projeção de saldo negativo
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-300">
                  Menor saldo previsto: {formatCurrency(resumo.menorSaldo)} | 
                  {resumo.diasNegativos} dia(s) com saldo negativo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Projeção de Fluxo de Caixa</CardTitle>
          <CardDescription>
            Evolução do saldo acumulado para os próximos {periodo} dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fluxoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="dataFormatada" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        saldoAcumulado: 'Saldo Acumulado',
                        entradas: 'Entradas',
                        saidas: 'Saídas'
                      };
                      return [formatCurrency(value), labels[name] || name];
                    }}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="5 5" />
                  <Area 
                    type="monotone" 
                    dataKey="saldoAcumulado" 
                    stroke="#3B82F6" 
                    fill="#3B82F6"
                    fillOpacity={0.3}
                    name="Saldo Acumulado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Diário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Data</th>
                  <th className="text-right py-2 px-4">Entradas</th>
                  <th className="text-right py-2 px-4">Saídas</th>
                  <th className="text-right py-2 px-4">Saldo Dia</th>
                  <th className="text-right py-2 px-4">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {fluxoData.map((item, index) => (
                  <tr key={item.data} className={`border-b ${
                    item.saldoAcumulado < 0 ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}>
                    <td className="py-2 px-4">
                      {formatLocalDateWithWeekday(item.data)}
                    </td>
                    <td className="text-right py-2 px-4 text-green-600">
                      {item.entradas > 0 ? formatCurrency(item.entradas) : '-'}
                    </td>
                    <td className="text-right py-2 px-4 text-red-600">
                      {item.saidas > 0 ? formatCurrency(item.saidas) : '-'}
                    </td>
                    <td className={`text-right py-2 px-4 font-medium ${
                      item.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(item.saldo)}
                    </td>
                    <td className={`text-right py-2 px-4 font-bold ${
                      item.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(item.saldoAcumulado)}
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
