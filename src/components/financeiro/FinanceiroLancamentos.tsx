import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Search, 
  Plus, 
  Filter,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Zap,
  Check
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { EditarLancamentoDialog } from './EditarLancamentoDialog';

interface Lancamento {
  id: string;
  tipo: 'receita' | 'despesa' | 'transferencia';
  valor: number;
  descricao: string;
  data_lancamento: string;
  status: string;
  origem: string | null;
  a_reembolsar: boolean;
  categoria: { nome: string; cor: string } | null;
  conta_origem: { nome: string } | null;
  cliente: { nome: string } | null;
}

interface FinanceiroLancamentosProps {
  onNovoLancamento: () => void;
}

// Atalhos rápidos predefinidos
const atalhosRapidos = [
  { tipo: 'despesa', descricao: 'Combustível', categoria: 'Transporte' },
  { tipo: 'despesa', descricao: 'Almoço equipe', categoria: 'Alimentação' },
  { tipo: 'despesa', descricao: 'Material escritório', categoria: 'Material de Escritório' },
  { tipo: 'receita', descricao: 'Honorários advocatícios', categoria: 'Honorários Contratuais' },
];

export function FinanceiroLancamentos({ onNovoLancamento }: FinanceiroLancamentosProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_atual');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Edição
  const [editarDialogOpen, setEditarDialogOpen] = useState(false);
  const [lancamentoEditandoId, setLancamentoEditandoId] = useState<string | null>(null);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      let dataInicio: Date;
      let dataFim: Date;
      const hoje = new Date();

      switch (filtroPeriodo) {
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
        default:
          dataInicio = startOfMonth(hoje);
          dataFim = endOfMonth(hoje);
      }

      let query = supabase
        .from('fin_lancamentos')
        .select(`
          id,
          tipo,
          valor,
          descricao,
          data_lancamento,
          status,
          origem,
          a_reembolsar,
          categoria:fin_categorias(nome, cor),
          conta_origem:fin_contas!fin_lancamentos_conta_origem_id_fkey(nome),
          cliente:fin_clientes(nome)
        `)
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .is('deleted_at', null)
        .order('data_lancamento', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo);
      }

      if (busca) {
        query = query.ilike('descricao', `%${busca}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLancamentos(data as Lancamento[] || []);
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      toast.error('Erro ao carregar lançamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLancamentos();
  }, [filtroTipo, filtroPeriodo, busca, page]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'receita':
        return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case 'despesa':
        return <ArrowDownCircle className="h-4 w-4 text-red-500" />;
      case 'transferencia':
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'cancelado':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      case 'agendado':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Agendado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleEdit = (id: string) => {
    setLancamentoEditandoId(id);
    setEditarDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    
    try {
      const { error } = await supabase
        .from('fin_lancamentos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Lançamento excluído com sucesso');
      fetchLancamentos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir lançamento');
    }
  };

  const handleDuplicate = async (lancamento: Lancamento) => {
    try {
      // Buscar dados completos do lançamento
      const { data: original, error: fetchError } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .eq('id', lancamento.id)
        .single();

      if (fetchError) throw fetchError;

      // Criar cópia sem id e com nova data
      const { id, created_at, updated_at, deleted_at, ...dadosCopia } = original;
      
      const { error } = await supabase
        .from('fin_lancamentos')
        .insert({
          ...dadosCopia,
          data_lancamento: new Date().toISOString().split('T')[0],
          descricao: `${dadosCopia.descricao} (cópia)`,
          status: 'pendente',
          created_by: user?.id
        });

      if (error) throw error;
      
      toast.success('Lançamento duplicado com sucesso!');
      fetchLancamentos();
    } catch (error) {
      console.error('Erro ao duplicar:', error);
      toast.error('Erro ao duplicar lançamento');
    }
  };

  const handleQuickPay = async (id: string) => {
    try {
      const { error } = await supabase
        .from('fin_lancamentos')
        .update({ 
          status: 'pago', 
          data_pagamento: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Lançamento marcado como pago!');
      fetchLancamentos();
    } catch (error) {
      console.error('Erro ao quitar:', error);
      toast.error('Erro ao quitar lançamento');
    }
  };

  const handleAtalhoRapido = async (atalho: typeof atalhosRapidos[0]) => {
    try {
      // Buscar categoria
      const { data: categoria } = await supabase
        .from('fin_categorias')
        .select('id')
        .ilike('nome', `%${atalho.categoria}%`)
        .eq('tipo', atalho.tipo)
        .single();

      // Buscar primeira conta ativa
      const { data: conta } = await supabase
        .from('fin_contas')
        .select('id')
        .eq('ativa', true)
        .limit(1)
        .single();

      const { error } = await supabase
        .from('fin_lancamentos')
        .insert({
          tipo: atalho.tipo,
          descricao: atalho.descricao,
          categoria_id: categoria?.id || null,
          conta_origem_id: conta?.id || null,
          valor: 0,
          data_lancamento: new Date().toISOString().split('T')[0],
          status: 'pendente',
          origem: 'escritorio',
          created_by: user?.id
        });

      if (error) throw error;

      toast.success(`Lançamento "${atalho.descricao}" criado! Edite para adicionar o valor.`);
      fetchLancamentos();
    } catch (error) {
      console.error('Erro ao criar atalho:', error);
      toast.error('Erro ao criar lançamento rápido');
    }
  };

  const exportarExcel = () => {
    if (lancamentos.length === 0) {
      toast.error('Nenhum lançamento para exportar');
      return;
    }

    const dadosExport = lancamentos.map(l => ({
      Data: format(new Date(l.data_lancamento), 'dd/MM/yyyy'),
      Tipo: l.tipo,
      Categoria: l.categoria?.nome || '-',
      Descrição: l.descricao,
      Conta: l.conta_origem?.nome || '-',
      Valor: l.valor,
      Status: l.status
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');
    XLSX.writeFile(wb, `lancamentos_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Excel exportado com sucesso!');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lançamentos</CardTitle>
              <CardDescription>Histórico de movimentações financeiras</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Zap className="h-4 w-4 mr-2" />
                    Atalhos
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {atalhosRapidos.map((atalho, idx) => (
                    <DropdownMenuItem key={idx} onClick={() => handleAtalhoRapido(atalho)}>
                      {atalho.tipo === 'receita' ? (
                        <ArrowUpCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 mr-2 text-red-500" />
                      )}
                      {atalho.descricao}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={exportarExcel}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={onNovoLancamento}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
                <SelectItem value="transferencia">Transferências</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                <SelectItem value="trimestre">Último Trimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : lancamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  lancamentos.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.status !== 'pago' ? (
                          <button
                            onClick={() => handleQuickPay(l.id)}
                            className="h-5 w-5 rounded border-2 border-muted-foreground/30 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950 flex items-center justify-center transition-colors"
                            title="Marcar como pago"
                          >
                          </button>
                        ) : (
                          <div className="h-5 w-5 rounded bg-green-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTipoIcon(l.tipo)}
                          <span className="capitalize">{l.tipo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.categoria ? (
                          <Badge 
                            variant="outline" 
                            style={{ 
                              backgroundColor: l.categoria.cor + '20', 
                              borderColor: l.categoria.cor,
                              color: l.categoria.cor 
                            }}
                          >
                            {l.categoria.nome}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={l.descricao}>
                          {l.descricao}
                          {l.a_reembolsar && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              A Reembolsar
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{l.conta_origem?.nome || '-'}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        l.tipo === 'receita' ? 'text-green-600' : 
                        l.tipo === 'despesa' ? 'text-red-600' : ''
                      }`}>
                        {l.tipo === 'despesa' && '-'}
                        {formatCurrency(l.valor)}
                      </TableCell>
                      <TableCell>{getStatusBadge(l.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(l.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(l)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(l.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {lancamentos.length} lançamentos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm">Página {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={lancamentos.length < pageSize}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditarLancamentoDialog
        open={editarDialogOpen}
        onOpenChange={setEditarDialogOpen}
        lancamentoId={lancamentoEditandoId}
        onSuccess={() => {
          setEditarDialogOpen(false);
          fetchLancamentos();
        }}
      />
    </>
  );
}
