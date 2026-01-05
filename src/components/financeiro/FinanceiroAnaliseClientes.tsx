import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Calendar,
  Loader2,
  Package,
  ArrowUpDown
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface ClienteAnalise {
  id: string;
  nome: string;
  totalReceitas: number;
  totalDespesas: number;
  lucro: number;
  margemLucro: number;
  qtdLancamentos: number;
}

interface ProdutoAnalise {
  produto: string;
  totalReceitas: number;
  qtdClientes: number;
  ticketMedio: number;
}

export function FinanceiroAnaliseClientes() {
  const [periodo, setPeriodo] = useState('ano');
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteAnalise[]>([]);
  const [produtos, setProdutos] = useState<ProdutoAnalise[]>([]);
  const [totais, setTotais] = useState({
    totalReceitas: 0,
    totalDespesas: 0,
    totalLucro: 0,
    qtdClientes: 0
  });
  const [ordenacao, setOrdenacao] = useState<'lucro' | 'receitas' | 'despesas'>('lucro');

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

      // Buscar todos os clientes
      const { data: clientesData } = await supabase
        .from('fin_clientes')
        .select('id, nome')
        .eq('ativo', true);

      // Buscar lançamentos do período
      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Calcular métricas por cliente
      const clienteMap = new Map<string, ClienteAnalise>();

      clientesData?.forEach(c => {
        clienteMap.set(c.id, {
          id: c.id,
          nome: c.nome,
          totalReceitas: 0,
          totalDespesas: 0,
          lucro: 0,
          margemLucro: 0,
          qtdLancamentos: 0
        });
      });

      lancamentos?.forEach(l => {
        if (!l.cliente_id || !clienteMap.has(l.cliente_id)) return;
        
        const cliente = clienteMap.get(l.cliente_id)!;
        cliente.qtdLancamentos++;
        
        if (l.tipo === 'receita') {
          cliente.totalReceitas += Number(l.valor);
        } else if (l.tipo === 'despesa') {
          cliente.totalDespesas += Number(l.valor);
        }
      });

      // Calcular lucro e margem
      clienteMap.forEach(cliente => {
        cliente.lucro = cliente.totalReceitas - cliente.totalDespesas;
        cliente.margemLucro = cliente.totalReceitas > 0 
          ? (cliente.lucro / cliente.totalReceitas) * 100 
          : 0;
      });

      // Filtrar clientes com movimentação e ordenar
      const clientesComMovimentacao = Array.from(clienteMap.values())
        .filter(c => c.qtdLancamentos > 0)
        .sort((a, b) => {
          switch (ordenacao) {
            case 'receitas': return b.totalReceitas - a.totalReceitas;
            case 'despesas': return b.totalDespesas - a.totalDespesas;
            default: return b.lucro - a.lucro;
          }
        });

      setClientes(clientesComMovimentacao);

      // Calcular totais
      const totalReceitas = clientesComMovimentacao.reduce((acc, c) => acc + c.totalReceitas, 0);
      const totalDespesas = clientesComMovimentacao.reduce((acc, c) => acc + c.totalDespesas, 0);
      
      setTotais({
        totalReceitas,
        totalDespesas,
        totalLucro: totalReceitas - totalDespesas,
        qtdClientes: clientesComMovimentacao.length
      });

      // Análise por produto (usando produto_rd_station)
      const produtoMap = new Map<string, { receitas: number; clientes: Set<string> }>();
      
      lancamentos?.filter(l => l.tipo === 'receita' && l.produto_rd_station).forEach(l => {
        const produto = l.produto_rd_station!;
        const atual = produtoMap.get(produto) || { receitas: 0, clientes: new Set<string>() };
        atual.receitas += Number(l.valor);
        if (l.cliente_id) atual.clientes.add(l.cliente_id);
        produtoMap.set(produto, atual);
      });

      const produtosAnalise = Array.from(produtoMap.entries())
        .map(([produto, data]) => ({
          produto,
          totalReceitas: data.receitas,
          qtdClientes: data.clientes.size,
          ticketMedio: data.clientes.size > 0 ? data.receitas / data.clientes.size : 0
        }))
        .sort((a, b) => b.totalReceitas - a.totalReceitas);

      setProdutos(produtosAnalise);

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodo, ordenacao]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          
          <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lucro">Ordenar por Lucro</SelectItem>
              <SelectItem value="receitas">Ordenar por Receitas</SelectItem>
              <SelectItem value="despesas">Ordenar por Despesas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
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
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totais.qtdClientes}</div>
                <p className="text-xs text-muted-foreground">Com movimentação no período</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Receitas de Clientes</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totais.totalReceitas)}</div>
                <p className="text-xs text-muted-foreground">Honorários recebidos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Despesas com Clientes</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(totais.totalDespesas)}</div>
                <p className="text-xs text-muted-foreground">Custas, taxas, etc</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Lucro com Clientes</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totais.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totais.totalLucro)}
                </div>
                <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
              </CardContent>
            </Card>
          </div>

          {/* Análise por Produto */}
          {produtos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Análise por Produto
                </CardTitle>
                <CardDescription>Receitas por tipo de serviço/produto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={produtos.slice(0, 6)}
                          dataKey="totalReceitas"
                          nameKey="produto"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ produto, percent }) => `${produto} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {produtos.slice(0, 6).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {produtos.slice(0, 6).map((p, index) => (
                      <div key={p.produto} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium text-sm">{p.produto}</p>
                            <p className="text-xs text-muted-foreground">{p.qtdClientes} cliente(s)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(p.totalReceitas)}</p>
                          <p className="text-xs text-muted-foreground">Ticket: {formatCurrency(p.ticketMedio)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top 10 Clientes por {ordenacao === 'lucro' ? 'Lucro' : ordenacao === 'receitas' ? 'Receitas' : 'Despesas'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={clientes.slice(0, 10)} 
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <YAxis 
                      dataKey="nome" 
                      type="category" 
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="totalReceitas" name="Receitas" fill="#10B981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="totalDespesas" name="Despesas" fill="#EF4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tabela Completa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Receitas</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-center">Lançamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.slice(0, 20).map(cliente => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(cliente.totalReceitas)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(cliente.totalDespesas)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${cliente.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(cliente.lucro)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={cliente.margemLucro >= 50 ? 'default' : cliente.margemLucro >= 20 ? 'secondary' : 'destructive'}>
                          {cliente.margemLucro.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{cliente.qtdLancamentos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {clientes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum cliente com movimentação no período
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
