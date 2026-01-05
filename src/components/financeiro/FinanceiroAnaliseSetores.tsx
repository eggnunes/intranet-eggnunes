import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Calendar,
  Loader2,
  PieChart as PieChartIcon,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, ComposedChart, Line } from 'recharts';

interface SetorAnalise {
  id: string;
  nome: string;
  totalDespesas: number;
  percentual: number;
  qtdLancamentos: number;
  categorias: { nome: string; valor: number }[];
  variacaoMes: number;
}

interface EvolucaoSetor {
  mes: string;
  [key: string]: string | number;
}

export function FinanceiroAnaliseSetores() {
  const [periodo, setPeriodo] = useState('ano');
  const [loading, setLoading] = useState(true);
  const [setores, setSetores] = useState<SetorAnalise[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoSetor[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      let dataInicio: Date;
      let dataFim: Date;

      switch (periodo) {
        case 'mes_atual':
          dataInicio = startOfMonth(hoje);
          dataFim = endOfMonth(hoje);
          break;
        case 'trimestre':
          dataInicio = startOfMonth(subMonths(hoje, 2));
          dataFim = endOfMonth(hoje);
          break;
        case 'semestre':
          dataInicio = startOfMonth(subMonths(hoje, 5));
          dataFim = endOfMonth(hoje);
          break;
        case 'ano':
        default:
          dataInicio = startOfYear(hoje);
          dataFim = endOfYear(hoje);
      }

      // Buscar setores
      const { data: setoresData } = await supabase
        .from('fin_setores')
        .select('id, nome')
        .eq('ativo', true);

      // Buscar lançamentos do período atual
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select(`
          *,
          categoria:fin_categorias(nome),
          setor:fin_setores(nome)
        `)
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .eq('tipo', 'despesa')
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Buscar lançamentos do mês anterior para comparação
      const mesAnteriorInicio = startOfMonth(subMonths(hoje, 1));
      const mesAnteriorFim = endOfMonth(subMonths(hoje, 1));
      
      const { data: lancamentosMesAnterior } = await supabase
        .from('fin_lancamentos')
        .select('setor_id, valor')
        .gte('data_lancamento', format(mesAnteriorInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(mesAnteriorFim, 'yyyy-MM-dd'))
        .eq('tipo', 'despesa')
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Mês atual
      const mesAtualInicio = startOfMonth(hoje);
      const mesAtualFim = endOfMonth(hoje);
      
      const { data: lancamentosMesAtual } = await supabase
        .from('fin_lancamentos')
        .select('setor_id, valor')
        .gte('data_lancamento', format(mesAtualInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(mesAtualFim, 'yyyy-MM-dd'))
        .eq('tipo', 'despesa')
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Calcular totais por setor
      const setorMap = new Map<string, SetorAnalise>();

      setoresData?.forEach(s => {
        setorMap.set(s.id, {
          id: s.id,
          nome: s.nome,
          totalDespesas: 0,
          percentual: 0,
          qtdLancamentos: 0,
          categorias: [],
          variacaoMes: 0
        });
      });

      // Calcular despesas por setor
      const categoriasPorSetor = new Map<string, Map<string, number>>();
      
      lancamentos?.forEach(l => {
        if (!l.setor_id || !setorMap.has(l.setor_id)) return;
        
        const setor = setorMap.get(l.setor_id)!;
        setor.totalDespesas += Number(l.valor);
        setor.qtdLancamentos++;

        // Agrupar por categoria
        if (!categoriasPorSetor.has(l.setor_id)) {
          categoriasPorSetor.set(l.setor_id, new Map());
        }
        const catMap = categoriasPorSetor.get(l.setor_id)!;
        const catNome = l.categoria?.nome || 'Sem categoria';
        catMap.set(catNome, (catMap.get(catNome) || 0) + Number(l.valor));
      });

      // Adicionar categorias aos setores
      categoriasPorSetor.forEach((catMap, setorId) => {
        const setor = setorMap.get(setorId);
        if (setor) {
          setor.categorias = Array.from(catMap.entries())
            .map(([nome, valor]) => ({ nome, valor }))
            .sort((a, b) => b.valor - a.valor);
        }
      });

      // Calcular variação mês a mês
      const gastoMesAnteriorPorSetor = new Map<string, number>();
      lancamentosMesAnterior?.forEach(l => {
        if (l.setor_id) {
          gastoMesAnteriorPorSetor.set(
            l.setor_id, 
            (gastoMesAnteriorPorSetor.get(l.setor_id) || 0) + Number(l.valor)
          );
        }
      });

      const gastoMesAtualPorSetor = new Map<string, number>();
      lancamentosMesAtual?.forEach(l => {
        if (l.setor_id) {
          gastoMesAtualPorSetor.set(
            l.setor_id, 
            (gastoMesAtualPorSetor.get(l.setor_id) || 0) + Number(l.valor)
          );
        }
      });

      setorMap.forEach((setor, id) => {
        const anterior = gastoMesAnteriorPorSetor.get(id) || 0;
        const atual = gastoMesAtualPorSetor.get(id) || 0;
        setor.variacaoMes = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
      });

      // Calcular total e percentuais
      const total = Array.from(setorMap.values()).reduce((acc, s) => acc + s.totalDespesas, 0);
      setTotalGeral(total);

      setorMap.forEach(setor => {
        setor.percentual = total > 0 ? (setor.totalDespesas / total) * 100 : 0;
      });

      // Ordenar por total de despesas
      const setoresOrdenados = Array.from(setorMap.values())
        .filter(s => s.qtdLancamentos > 0)
        .sort((a, b) => b.totalDespesas - a.totalDespesas);

      setSetores(setoresOrdenados);

      // Evolução mensal por setor (últimos 6 meses)
      const evolucaoData: EvolucaoSetor[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(hoje, i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = endOfMonth(mesData);
        
        const { data: mesLancamentos } = await supabase
          .from('fin_lancamentos')
          .select('setor_id, valor')
          .gte('data_lancamento', format(mesInicio, 'yyyy-MM-dd'))
          .lte('data_lancamento', format(mesFim, 'yyyy-MM-dd'))
          .eq('tipo', 'despesa')
          .eq('status', 'pago')
          .is('deleted_at', null);

        const mesEvolucao: EvolucaoSetor = {
          mes: format(mesData, 'MMM/yy', { locale: ptBR })
        };

        // Agrupar por setor
        const setorGastos = new Map<string, number>();
        mesLancamentos?.forEach(l => {
          if (l.setor_id) {
            setorGastos.set(l.setor_id, (setorGastos.get(l.setor_id) || 0) + Number(l.valor));
          }
        });

        setoresData?.forEach(s => {
          mesEvolucao[s.nome] = setorGastos.get(s.id) || 0;
        });

        evolucaoData.push(mesEvolucao);
      }

      setEvolucao(evolucaoData);

    } catch (error) {
      console.error('Erro:', error);
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

  const getVariacaoIcon = (value: number) => {
    if (Math.abs(value) < 1) return <Minus className="h-4 w-4 text-gray-500" />;
    // Para despesas, aumento é ruim (vermelho), diminuição é bom (verde)
    return value > 0 
      ? <ArrowUp className="h-4 w-4 text-red-500" />
      : <ArrowDown className="h-4 w-4 text-green-500" />;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_atual">Mês Atual</SelectItem>
            <SelectItem value="trimestre">Último Trimestre</SelectItem>
            <SelectItem value="semestre">Último Semestre</SelectItem>
            <SelectItem value="ano">Ano Atual</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Card Total */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Total de Despesas por Setor</CardTitle>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{formatCurrency(totalGeral)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Distribuído em {setores.length} setor(es)
              </p>
            </CardContent>
          </Card>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pizza */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Distribuição por Setor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={setores}
                        dataKey="totalDespesas"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ nome, percentual }) => `${nome} (${percentual.toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {setores.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Barras */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gastos por Setor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={setores} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="totalDespesas" radius={[0, 4, 4, 0]}>
                        {setores.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução Mensal por Setor</CardTitle>
              <CardDescription>Gastos dos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {setores.slice(0, 5).map((setor, index) => (
                      <Bar 
                        key={setor.nome}
                        dataKey={setor.nome} 
                        stackId="a"
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cards por Setor */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {setores.map((setor, index) => (
              <Card key={setor.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {setor.nome}
                    </CardTitle>
                    <Badge variant="outline">{setor.percentual.toFixed(1)}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(setor.totalDespesas)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {getVariacaoIcon(setor.variacaoMes)}
                      <span className={`text-sm ${setor.variacaoMes <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {setor.variacaoMes > 0 ? '+' : ''}{setor.variacaoMes.toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground">vs mês anterior</span>
                    </div>
                  </div>
                  
                  <Progress 
                    value={setor.percentual} 
                    className="h-2"
                  />
                  
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Top categorias:</p>
                    {setor.categorias.slice(0, 3).map(cat => (
                      <div key={cat.nome} className="flex justify-between text-xs">
                        <span className="truncate">{cat.nome}</span>
                        <span className="font-medium">{formatCurrency(cat.valor)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Setor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                    <TableHead className="text-right">Var. Mês</TableHead>
                    <TableHead className="text-center">Lançamentos</TableHead>
                    <TableHead>Principal Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {setores.map((setor, index) => (
                    <TableRow key={setor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{setor.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatCurrency(setor.totalDespesas)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{setor.percentual.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getVariacaoIcon(setor.variacaoMes)}
                          <span className={setor.variacaoMes <= 0 ? 'text-green-600' : 'text-red-600'}>
                            {setor.variacaoMes > 0 ? '+' : ''}{setor.variacaoMes.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{setor.qtdLancamentos}</TableCell>
                      <TableCell>
                        {setor.categorias[0]?.nome || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {setores.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma despesa por setor no período
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
