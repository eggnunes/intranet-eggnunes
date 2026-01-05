import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  DollarSign,
  Users,
  FileCheck,
  Brain,
  Download,
  Loader2,
  PieChart,
  Target,
  Shield
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface HealthMetric {
  nome: string;
  valor: number;
  meta: number;
  status: 'bom' | 'atencao' | 'critico';
  descricao: string;
}

interface ClienteMargemData {
  id: string;
  nome: string;
  receitas: number;
  despesas: number;
  margem: number;
  percentual: number;
}

export function RelatorioSaudeFinanceira() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<HealthMetric[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const inicio = startOfMonth(subMonths(hoje, 2));
      const fim = endOfMonth(hoje);

      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .gte('data_lancamento', format(inicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(fim, 'yyyy-MM-dd'))
        .is('deleted_at', null);

      const { data: contas } = await supabase
        .from('fin_contas')
        .select('saldo_atual')
        .eq('ativa', true);

      const { data: pendentes } = await supabase
        .from('fin_lancamentos')
        .select('valor, tipo')
        .eq('status', 'pendente')
        .is('deleted_at', null);

      const receitasPagas = lancamentos?.filter(l => l.tipo === 'receita' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      const despesasPagas = lancamentos?.filter(l => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

      const saldoTotal = contas?.reduce((acc, c) => acc + Number(c.saldo_atual), 0) || 0;
      
      const receitasPendentes = pendentes?.filter(l => l.tipo === 'receita')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
      const despesasPendentes = pendentes?.filter(l => l.tipo === 'despesa')
        .reduce((acc, l) => acc + Number(l.valor), 0) || 0;

      const margem = receitasPagas > 0 ? ((receitasPagas - despesasPagas) / receitasPagas) * 100 : 0;
      const liquidezCorrente = despesasPendentes > 0 ? saldoTotal / despesasPendentes : 999;
      const indiceCobertura = despesasPagas > 0 ? (receitasPagas / despesasPagas) : 0;

      const calcMetricas: HealthMetric[] = [
        {
          nome: 'Margem Operacional',
          valor: margem,
          meta: 20,
          status: margem >= 20 ? 'bom' : margem >= 10 ? 'atencao' : 'critico',
          descricao: 'Lucro sobre a receita total'
        },
        {
          nome: 'Liquidez Corrente',
          valor: Math.min(liquidezCorrente, 5),
          meta: 1.5,
          status: liquidezCorrente >= 1.5 ? 'bom' : liquidezCorrente >= 1 ? 'atencao' : 'critico',
          descricao: 'Capacidade de pagar obrigações'
        },
        {
          nome: 'Índice de Cobertura',
          valor: indiceCobertura,
          meta: 1.2,
          status: indiceCobertura >= 1.2 ? 'bom' : indiceCobertura >= 1 ? 'atencao' : 'critico',
          descricao: 'Receitas vs Despesas'
        },
        {
          nome: 'Taxa de Recebimento',
          valor: receitasPagas > 0 ? (receitasPagas / (receitasPagas + receitasPendentes)) * 100 : 0,
          meta: 80,
          status: receitasPagas / (receitasPagas + receitasPendentes) >= 0.8 ? 'bom' : 
                  receitasPagas / (receitasPagas + receitasPendentes) >= 0.6 ? 'atencao' : 'critico',
          descricao: 'Percentual de receitas recebidas'
        }
      ];

      // Calcular score geral
      const scoreGeral = calcMetricas.reduce((acc, m) => {
        if (m.status === 'bom') return acc + 25;
        if (m.status === 'atencao') return acc + 12.5;
        return acc;
      }, 0);

      setMetricas(calcMetricas);
      setScore(scoreGeral);
    } catch (error) {
      console.error('Erro ao calcular métricas:', error);
      toast.error('Erro ao gerar relatório de saúde financeira');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'bom': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'atencao': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critico': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getScoreColor = () => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 75) return 'Saudável';
    if (score >= 50) return 'Atenção';
    return 'Crítico';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Saúde Financeira do Escritório
          </CardTitle>
          <CardDescription>Análise baseada nos últimos 3 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor()}`}>{score.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">de 100</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${getScoreColor()}`}>{getScoreLabel()}</span>
              </div>
              <Progress value={score} className="h-3" />
            </div>
            <Badge 
              variant={score >= 75 ? 'default' : score >= 50 ? 'secondary' : 'destructive'}
              className="text-lg px-4 py-2"
            >
              {getScoreLabel()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metricas.map((m) => (
          <Card key={m.nome}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(m.status)}
                    <span className="font-medium">{m.nome}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.descricao}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {m.valor.toFixed(1)}{m.nome.includes('%') || m.nome.includes('Taxa') ? '%' : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">Meta: {m.meta}</div>
                </div>
              </div>
              <Progress 
                value={Math.min((m.valor / m.meta) * 100, 100)} 
                className={`h-2 mt-4 ${
                  m.status === 'bom' ? 'bg-green-100' : 
                  m.status === 'atencao' ? 'bg-yellow-100' : 'bg-red-100'
                }`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RelatorioMargemCliente() {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteMargemData[]>([]);
  const [periodo, setPeriodo] = useState('trimestre');

  useEffect(() => {
    fetchData();
  }, [periodo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      let inicio: Date;

      switch (periodo) {
        case 'mes': inicio = startOfMonth(hoje); break;
        case 'trimestre': inicio = startOfMonth(subMonths(hoje, 2)); break;
        case 'semestre': inicio = startOfMonth(subMonths(hoje, 5)); break;
        case 'ano': inicio = startOfMonth(subMonths(hoje, 11)); break;
        default: inicio = startOfMonth(subMonths(hoje, 2));
      }

      const { data: clientesData } = await supabase
        .from('fin_clientes')
        .select('id, nome')
        .eq('ativo', true);

      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('cliente_id, tipo, valor')
        .gte('data_lancamento', format(inicio, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null)
        .not('cliente_id', 'is', null);

      const clientesMap = new Map<string, { receitas: number; despesas: number }>();
      
      lancamentos?.forEach(l => {
        if (!l.cliente_id) return;
        const atual = clientesMap.get(l.cliente_id) || { receitas: 0, despesas: 0 };
        if (l.tipo === 'receita') {
          atual.receitas += Number(l.valor);
        } else if (l.tipo === 'despesa') {
          atual.despesas += Number(l.valor);
        }
        clientesMap.set(l.cliente_id, atual);
      });

      const resultado: ClienteMargemData[] = [];
      clientesData?.forEach(c => {
        const dados = clientesMap.get(c.id);
        if (dados && (dados.receitas > 0 || dados.despesas > 0)) {
          const margem = dados.receitas - dados.despesas;
          const percentual = dados.receitas > 0 ? (margem / dados.receitas) * 100 : 0;
          resultado.push({
            id: c.id,
            nome: c.nome,
            receitas: dados.receitas,
            despesas: dados.despesas,
            margem,
            percentual
          });
        }
      });

      resultado.sort((a, b) => b.margem - a.margem);
      setClientes(resultado);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Margem por Cliente', 14, 15);
    doc.text(`Período: ${periodo}`, 14, 22);
    
    autoTable(doc, {
      head: [['Cliente', 'Receitas', 'Despesas', 'Margem', '%']],
      body: clientes.map(c => [
        c.nome,
        formatCurrency(c.receitas),
        formatCurrency(c.despesas),
        formatCurrency(c.margem),
        `${c.percentual.toFixed(1)}%`
      ]),
      startY: 30,
    });

    doc.save('margem-por-cliente.pdf');
    toast.success('PDF exportado!');
  };

  const exportExcel = () => {
    const dados = clientes.map(c => ({
      Cliente: c.nome,
      Receitas: c.receitas,
      Despesas: c.despesas,
      Margem: c.margem,
      'Margem %': c.percentual
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Margem por Cliente');
    XLSX.writeFile(wb, 'margem-por-cliente.xlsx');
    toast.success('Excel exportado!');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Margem por Cliente
            </CardTitle>
            <CardDescription>Análise de lucratividade por cliente</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês Atual</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="semestre">Semestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportPDF}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={exportExcel}>
              <FileCheck className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(c.receitas)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(c.despesas)}</TableCell>
                  <TableCell className={`text-right font-medium ${c.margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(c.margem)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.percentual >= 20 ? 'default' : c.percentual >= 0 ? 'secondary' : 'destructive'}>
                      {c.percentual.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function RelatorioConformidade() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<{ item: string; status: 'ok' | 'pendente' | 'alerta'; descricao: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const mesAtual = startOfMonth(hoje);

      // Verificar conciliação bancária
      const { count: naoConc } = await supabase
        .from('fin_lancamentos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pago')
        .eq('conciliado', false)
        .is('deleted_at', null);

      // Verificar lançamentos sem categoria
      const { count: semCat } = await supabase
        .from('fin_lancamentos')
        .select('id', { count: 'exact', head: true })
        .is('categoria_id', null)
        .is('deleted_at', null);

      // Verificar lançamentos sem anexo (para despesas > 500)
      const { count: semAnexo } = await supabase
        .from('fin_lancamentos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'despesa')
        .gte('valor', 500)
        .is('anexo_url', null)
        .is('deleted_at', null);

      // Verificar aprovações pendentes
      const { count: pendAprov } = await supabase
        .from('fin_lancamentos')
        .select('id', { count: 'exact', head: true })
        .eq('requer_aprovacao', true)
        .eq('status_aprovacao', 'pendente')
        .is('deleted_at', null);

      const checksResult = [
        {
          item: 'Conciliação Bancária',
          status: (naoConc || 0) === 0 ? 'ok' : (naoConc || 0) < 10 ? 'pendente' : 'alerta',
          descricao: (naoConc || 0) === 0 ? 'Todos lançamentos conciliados' : `${naoConc} lançamentos não conciliados`
        },
        {
          item: 'Categorização',
          status: (semCat || 0) === 0 ? 'ok' : (semCat || 0) < 5 ? 'pendente' : 'alerta',
          descricao: (semCat || 0) === 0 ? 'Todos lançamentos categorizados' : `${semCat} lançamentos sem categoria`
        },
        {
          item: 'Comprovantes Fiscais',
          status: (semAnexo || 0) === 0 ? 'ok' : (semAnexo || 0) < 5 ? 'pendente' : 'alerta',
          descricao: (semAnexo || 0) === 0 ? 'Todas despesas com comprovante' : `${semAnexo} despesas (>R$500) sem anexo`
        },
        {
          item: 'Aprovações',
          status: (pendAprov || 0) === 0 ? 'ok' : 'pendente',
          descricao: (pendAprov || 0) === 0 ? 'Nenhuma aprovação pendente' : `${pendAprov} aprovações pendentes`
        }
      ] as typeof checks;

      setChecks(checksResult);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pendente': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'alerta': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const totalOk = checks.filter(c => c.status === 'ok').length;
  const conformidade = (totalOk / checks.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Relatório de Conformidade
        </CardTitle>
        <CardDescription>Verificação de compliance financeiro</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-green-600">{conformidade.toFixed(0)}%</div>
          <Progress value={conformidade} className="flex-1 h-3" />
          <Badge variant={conformidade === 100 ? 'default' : 'secondary'}>
            {totalOk}/{checks.length} itens OK
          </Badge>
        </div>

        <div className="space-y-3">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <div>
                  <div className="font-medium">{check.item}</div>
                  <div className="text-sm text-muted-foreground">{check.descricao}</div>
                </div>
              </div>
              <Badge variant={check.status === 'ok' ? 'default' : check.status === 'pendente' ? 'secondary' : 'destructive'}>
                {check.status === 'ok' ? 'OK' : check.status === 'pendente' ? 'Pendente' : 'Atenção'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
