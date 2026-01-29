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
  Calendar
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  contasSaldo: { nome: string; saldo: number; cor: string; isAsaas?: boolean }[];
  despesasReembolsar: number;
  receitasPorCategoria: { nome: string; valor: number; cor: string }[];
  despesasPorCategoria: { nome: string; valor: number; cor: string }[];
  evolucaoMensal: { mes: string; receitas: number; despesas: number }[];
}

export function FinanceiroDashboard() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    totalReceitas: 0,
    totalDespesas: 0,
    saldo: 0,
    contasSaldo: [],
    despesasReembolsar: 0,
    receitasPorCategoria: [],
    despesasPorCategoria: [],
    evolucaoMensal: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      let dataInicio: Date;
      let dataFim: Date;
      const hoje = new Date();

      switch (periodo) {
        case 'mes_atual':
          dataInicio = startOfMonth(hoje);
          dataFim = endOfMonth(hoje);
          break;
        case 'mes_anterior':
          dataInicio = startOfMonth(subMonths(hoje, 1));
          dataFim = endOfMonth(subMonths(hoje, 1));
          break;
        case 'trimestre':
          dataInicio = startOfMonth(subMonths(hoje, 2));
          dataFim = endOfMonth(hoje);
          break;
        case 'ano':
          dataInicio = startOfYear(hoje);
          dataFim = endOfYear(hoje);
          break;
        default:
          dataInicio = startOfMonth(hoje);
          dataFim = endOfMonth(hoje);
      }

      // Fetch contas
      const { data: contas } = await supabase
        .from('fin_contas')
        .select('*')
        .eq('ativa', true);

      // Fetch lançamentos do período
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select(`
          *,
          categoria:fin_categorias(nome, cor)
        `)
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .is('deleted_at', null);

      // Fetch despesas a reembolsar
      const { data: reembolsos } = await supabase
        .from('fin_lancamentos')
        .select('valor')
        .eq('a_reembolsar', true)
        .eq('reembolsada', false)
        .is('deleted_at', null);

      // Calcular totais
      const totalReceitas = lancamentos?.filter(l => l.tipo === 'receita' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      
      const totalDespesas = lancamentos?.filter(l => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

      const saldo = totalReceitas - totalDespesas;

      // Saldo por conta - preparar lista inicial
      let contasSaldo = contas?.map(c => ({
        nome: c.nome,
        saldo: Number(c.saldo_atual) || 0,
        cor: c.cor || '#3B82F6',
        isAsaas: c.nome?.toLowerCase().includes('asaas') || c.tipo === 'pagamentos'
      })) || [];

      // Buscar saldo real do Asaas via API
      try {
        const { data: asaasData, error: asaasError } = await supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_balance' }
        });
        
        if (!asaasError && asaasData?.balance !== undefined) {
          contasSaldo = contasSaldo.map(conta => {
            if (conta.isAsaas) {
              return { ...conta, saldo: Number(asaasData.balance) || 0 };
            }
            return conta;
          });
        }
      } catch (asaasErr) {
        console.log('Não foi possível obter saldo do Asaas:', asaasErr);
      }

      // Despesas a reembolsar
      const despesasReembolsar = reembolsos?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      // Receitas por categoria
      const receitasMap = new Map<string, { valor: number; cor: string }>();
      lancamentos?.filter(l => l.tipo === 'receita' && l.status === 'pago').forEach(l => {
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
      lancamentos?.filter(l => l.tipo === 'despesa' && l.status === 'pago').forEach(l => {
        const nome = l.categoria?.nome || 'Sem categoria';
        const cor = l.categoria?.cor || '#EF4444';
        const atual = despesasMap.get(nome) || { valor: 0, cor };
        despesasMap.set(nome, { valor: atual.valor + Number(l.valor), cor });
      });
      const despesasPorCategoria = Array.from(despesasMap.entries())
        .map(([nome, { valor, cor }]) => ({ nome, valor, cor }))
        .sort((a, b) => b.valor - a.valor);

      // Evolução mensal (últimos 6 meses)
      const evolucaoMensal: { mes: string; receitas: number; despesas: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mesData = subMonths(hoje, i);
        const mesInicio = startOfMonth(mesData);
        const mesFim = endOfMonth(mesData);
        
        const { data: mesLancamentos } = await supabase
          .from('fin_lancamentos')
          .select('tipo, valor, status')
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
          despesas: mesDespesas
        });
      }

      setData({
        totalReceitas,
        totalDespesas,
        saldo,
        contasSaldo,
        despesasReembolsar,
        receitasPorCategoria,
        despesasPorCategoria,
        evolucaoMensal
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

  const margemLucro = data.totalReceitas > 0 
    ? ((data.totalReceitas - data.totalDespesas) / data.totalReceitas * 100).toFixed(1)
    : '0.0';

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

      {/* Cards principais */}
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
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
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
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            {data.saldo >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.saldo)}
            </div>
            <p className="text-xs text-muted-foreground">
              Margem: {margemLucro}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">A Reembolsar</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.despesasReembolsar)}
            </div>
            <p className="text-xs text-muted-foreground">
              Despesas de clientes pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Saldo por Conta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saldo por Conta</CardTitle>
          <CardDescription>Distribuição atual por conta bancária</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.contasSaldo.map((conta) => (
              <div 
                key={conta.nome}
                className="p-4 rounded-lg border"
                style={{ borderLeftColor: conta.cor, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" style={{ color: conta.cor }} />
                  <span className="font-medium">{conta.nome}</span>
                </div>
                <div className="text-xl font-bold mt-2">
                  {formatCurrency(conta.saldo)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução Mensal</CardTitle>
            <CardDescription>Receitas vs Despesas nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Período: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="receitas" 
                    stackId="1"
                    stroke="#10B981" 
                    fill="#10B981"
                    fillOpacity={0.6}
                    name="Receitas"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="despesas" 
                    stackId="2"
                    stroke="#EF4444" 
                    fill="#EF4444"
                    fillOpacity={0.6}
                    name="Despesas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de Despesas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.despesasPorCategoria.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" fill="#EF4444" radius={[0, 4, 4, 0]}>
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

      {/* Top Categorias */}
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
