import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText,
  Download,
  Users,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar,
  Loader2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DadosRelatorio {
  tipo: string;
  dados: Record<string, unknown>[];
  totais?: Record<string, number>;
}

export function FinanceiroRelatorios() {
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('mes_atual');
  const [loading, setLoading] = useState(false);
  const [dadosRelatorio, setDadosRelatorio] = useState<DadosRelatorio | null>(null);

  const relatorios = [
    {
      id: 'dre',
      nome: 'DRE - Demonstrativo de Resultado',
      descricao: 'Receitas, despesas e resultado do período',
      icone: TrendingUp,
      cor: 'bg-blue-500'
    },
    {
      id: 'fluxo_caixa',
      nome: 'Fluxo de Caixa',
      descricao: 'Movimentação de entrada e saída por período',
      icone: BarChart3,
      cor: 'bg-green-500'
    },
    {
      id: 'despesas_categoria',
      nome: 'Despesas por Categoria',
      descricao: 'Análise detalhada das despesas por categoria',
      icone: PieChart,
      cor: 'bg-red-500'
    },
    {
      id: 'receitas_categoria',
      nome: 'Receitas por Categoria',
      descricao: 'Análise detalhada das receitas por categoria',
      icone: PieChart,
      cor: 'bg-emerald-500'
    },
    {
      id: 'cliente_rentabilidade',
      nome: 'Rentabilidade por Cliente',
      descricao: 'Receitas, despesas e lucro por cliente',
      icone: Users,
      cor: 'bg-purple-500'
    },
    {
      id: 'reembolsos',
      nome: 'Relatório de Reembolsos',
      descricao: 'Despesas de clientes pendentes e reembolsadas',
      icone: DollarSign,
      cor: 'bg-orange-500'
    },
    {
      id: 'despesas_setor',
      nome: 'Despesas por Setor',
      descricao: 'Análise de gastos por setor do escritório',
      icone: BarChart3,
      cor: 'bg-indigo-500'
    },
    {
      id: 'comparativo_mensal',
      nome: 'Comparativo Mensal',
      descricao: 'Comparação de receitas e despesas mês a mês',
      icone: Calendar,
      cor: 'bg-cyan-500'
    }
  ];

  const getDateRange = () => {
    const hoje = new Date();
    switch (periodo) {
      case 'mes_atual':
        return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) };
      case 'mes_anterior':
        return { inicio: startOfMonth(subMonths(hoje, 1)), fim: endOfMonth(subMonths(hoje, 1)) };
      case 'trimestre':
        return { inicio: startOfMonth(subMonths(hoje, 2)), fim: endOfMonth(hoje) };
      case 'semestre':
        return { inicio: startOfMonth(subMonths(hoje, 5)), fim: endOfMonth(hoje) };
      case 'ano':
        return { inicio: startOfYear(hoje), fim: endOfYear(hoje) };
      default:
        return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) };
    }
  };

  const gerarRelatorio = async (id: string) => {
    setRelatorioSelecionado(id);
    setLoading(true);
    setDadosRelatorio(null);

    try {
      const { inicio, fim } = getDateRange();
      const dataInicio = format(inicio, 'yyyy-MM-dd');
      const dataFim = format(fim, 'yyyy-MM-dd');

      let dados: Record<string, unknown>[] = [];
      let totais: Record<string, number> = {};

      switch (id) {
        case 'dre': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('tipo, valor, categoria:fin_categorias(nome, grupo)')
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null)
            .in('status', ['pago', 'pendente']);

          const receitas = lancamentos?.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + Number(l.valor), 0) || 0;
          const despesas = lancamentos?.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + Number(l.valor), 0) || 0;
          
          dados = [
            { descricao: 'Total de Receitas', valor: receitas },
            { descricao: 'Total de Despesas', valor: despesas },
            { descricao: 'Resultado Líquido', valor: receitas - despesas }
          ];
          totais = { receitas, despesas, resultado: receitas - despesas };
          break;
        }

        case 'despesas_categoria': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('valor, categoria:fin_categorias(nome)')
            .eq('tipo', 'despesa')
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          const agrupado: Record<string, number> = {};
          lancamentos?.forEach(l => {
            const cat = (l.categoria as { nome: string } | null)?.nome || 'Sem categoria';
            agrupado[cat] = (agrupado[cat] || 0) + Number(l.valor);
          });

          dados = Object.entries(agrupado).map(([categoria, valor]) => ({ categoria, valor }));
          totais = { total: dados.reduce((acc, d) => acc + (d.valor as number), 0) };
          break;
        }

        case 'receitas_categoria': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('valor, categoria:fin_categorias(nome)')
            .eq('tipo', 'receita')
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          const agrupado: Record<string, number> = {};
          lancamentos?.forEach(l => {
            const cat = (l.categoria as { nome: string } | null)?.nome || 'Sem categoria';
            agrupado[cat] = (agrupado[cat] || 0) + Number(l.valor);
          });

          dados = Object.entries(agrupado).map(([categoria, valor]) => ({ categoria, valor }));
          totais = { total: dados.reduce((acc, d) => acc + (d.valor as number), 0) };
          break;
        }

        case 'cliente_rentabilidade': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('tipo, valor, cliente:fin_clientes(nome)')
            .not('cliente_id', 'is', null)
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          const agrupado: Record<string, { receitas: number; despesas: number }> = {};
          lancamentos?.forEach(l => {
            const cliente = (l.cliente as { nome: string } | null)?.nome || 'Sem cliente';
            if (!agrupado[cliente]) agrupado[cliente] = { receitas: 0, despesas: 0 };
            if (l.tipo === 'receita') agrupado[cliente].receitas += Number(l.valor);
            else agrupado[cliente].despesas += Number(l.valor);
          });

          dados = Object.entries(agrupado).map(([cliente, vals]) => ({
            cliente,
            receitas: vals.receitas,
            despesas: vals.despesas,
            lucro: vals.receitas - vals.despesas
          }));
          break;
        }

        case 'reembolsos': {
          const { data: lancamentosReembolso } = await supabase
            .from('fin_lancamentos')
            .select('valor, descricao, data_lancamento, data_reembolso, cliente:fin_clientes(nome)')
            .eq('a_reembolsar', true)
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          dados = (lancamentosReembolso as { valor: number; descricao: string; data_lancamento: string; data_reembolso: string | null; cliente: { nome: string } | null }[] || []).map(l => ({
            cliente: l.cliente?.nome || '-',
            descricao: l.descricao,
            valor: l.valor,
            data: format(new Date(l.data_lancamento), 'dd/MM/yyyy'),
            status: l.data_reembolso ? 'Reembolsado' : 'Pendente'
          }));
          break;
        }

        case 'despesas_setor': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('valor, setor:fin_setores(nome)')
            .eq('tipo', 'despesa')
            .eq('origem', 'escritorio')
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          const agrupado: Record<string, number> = {};
          lancamentos?.forEach(l => {
            const setor = (l.setor as { nome: string } | null)?.nome || 'Sem setor';
            agrupado[setor] = (agrupado[setor] || 0) + Number(l.valor);
          });

          dados = Object.entries(agrupado).map(([setor, valor]) => ({ setor, valor }));
          totais = { total: dados.reduce((acc, d) => acc + (d.valor as number), 0) };
          break;
        }

        case 'fluxo_caixa':
        case 'comparativo_mensal': {
          const { data: lancamentos } = await supabase
            .from('fin_lancamentos')
            .select('tipo, valor, data_lancamento')
            .gte('data_lancamento', dataInicio)
            .lte('data_lancamento', dataFim)
            .is('deleted_at', null);

          const agrupado: Record<string, { receitas: number; despesas: number }> = {};
          lancamentos?.forEach(l => {
            const mes = format(new Date(l.data_lancamento), 'MM/yyyy');
            if (!agrupado[mes]) agrupado[mes] = { receitas: 0, despesas: 0 };
            if (l.tipo === 'receita') agrupado[mes].receitas += Number(l.valor);
            else if (l.tipo === 'despesa') agrupado[mes].despesas += Number(l.valor);
          });

          dados = Object.entries(agrupado).map(([mes, vals]) => ({
            mes,
            receitas: vals.receitas,
            despesas: vals.despesas,
            saldo: vals.receitas - vals.despesas
          }));
          break;
        }
      }

      setDadosRelatorio({ tipo: id, dados, totais });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportarExcel = () => {
    if (!dadosRelatorio) return;

    const ws = XLSX.utils.json_to_sheet(dadosRelatorio.dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    const nomeRelatorio = relatorios.find(r => r.id === relatorioSelecionado)?.nome || 'Relatório';
    XLSX.writeFile(wb, `${nomeRelatorio}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Excel exportado com sucesso!');
  };

  const exportarPDF = () => {
    if (!dadosRelatorio) return;

    const doc = new jsPDF();
    const nomeRelatorio = relatorios.find(r => r.id === relatorioSelecionado)?.nome || 'Relatório';
    
    doc.setFontSize(16);
    doc.text(nomeRelatorio, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Período: ${periodo.replace('_', ' ')}`, 14, 28);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 34);

    const columns = Object.keys(dadosRelatorio.dados[0] || {});
    const rows = dadosRelatorio.dados.map(d => 
      columns.map(col => {
        const val = d[col];
        if (typeof val === 'number') return formatCurrency(val);
        return String(val);
      })
    );

    autoTable(doc, {
      head: [columns.map(c => c.charAt(0).toUpperCase() + c.slice(1))],
      body: rows,
      startY: 42,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`${nomeRelatorio}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  const renderTabela = () => {
    if (!dadosRelatorio || dadosRelatorio.dados.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum dado encontrado para o período selecionado
        </div>
      );
    }

    const columns = Object.keys(dadosRelatorio.dados[0]);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col} className="capitalize">
                {col.replace(/_/g, ' ')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dadosRelatorio.dados.map((row, idx) => (
            <TableRow key={idx}>
              {columns.map(col => (
                <TableCell key={col}>
                  {typeof row[col] === 'number' 
                    ? formatCurrency(row[col] as number)
                    : String(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Financeiros</CardTitle>
          <CardDescription>
            Selecione um relatório para visualizar ou exportar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {relatorios.map((relatorio) => (
              <Card 
                key={relatorio.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  relatorioSelecionado === relatorio.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => gerarRelatorio(relatorio.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${relatorio.cor}`}>
                      <relatorio.icone className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{relatorio.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {relatorio.descricao}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {relatorioSelecionado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {relatorios.find(r => r.id === relatorioSelecionado)?.nome}
                </CardTitle>
                <CardDescription>
                  Configure os parâmetros do relatório
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={periodo} onValueChange={(v) => { setPeriodo(v); gerarRelatorio(relatorioSelecionado); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_atual">Mês Atual</SelectItem>
                    <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                    <SelectItem value="trimestre">Último Trimestre</SelectItem>
                    <SelectItem value="semestre">Último Semestre</SelectItem>
                    <SelectItem value="ano">Ano Atual</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={exportarExcel} disabled={!dadosRelatorio || loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" onClick={exportarPDF} disabled={!dadosRelatorio || loading}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button onClick={() => gerarRelatorio(relatorioSelecionado)} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gerar Relatório
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : dadosRelatorio ? (
              <div className="rounded-md border">
                {renderTabela()}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 border-2 border-dashed rounded-lg">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Configure e gere o relatório</p>
                  <p className="text-sm">
                    Selecione o período e clique em "Gerar Relatório"
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
