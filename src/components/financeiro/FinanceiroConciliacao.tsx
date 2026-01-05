import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Plus, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Scale,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conta {
  id: string;
  nome: string;
  saldo_atual: number;
}

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_lancamento: string;
  conciliado?: boolean;
}

interface Conciliacao {
  id: string;
  conta_id: string;
  data_conciliacao: string;
  saldo_banco: number;
  saldo_sistema: number;
  diferenca: number;
  status: string;
  conta?: { nome: string } | null;
}

export function FinanceiroConciliacao() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState<string>('');
  const [conciliacoes, setConciliacoes] = useState<Conciliacao[]>([]);
  const [lancamentosPendentes, setLancamentosPendentes] = useState<Lancamento[]>([]);
  const [lancamentosSelecionados, setLancamentosSelecionados] = useState<Set<string>>(new Set());
  
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form
  const [formDataConciliacao, setFormDataConciliacao] = useState(new Date().toISOString().split('T')[0]);
  const [formSaldoBanco, setFormSaldoBanco] = useState('');

  useEffect(() => {
    fetchContas();
    fetchConciliacoes();
  }, []);

  useEffect(() => {
    if (contaSelecionada) {
      fetchLancamentosPendentes();
    }
  }, [contaSelecionada]);

  const fetchContas = async () => {
    const { data } = await supabase
      .from('fin_contas')
      .select('id, nome, saldo_atual')
      .eq('ativa', true)
      .order('nome');
    setContas(data || []);
  };

  const fetchConciliacoes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fin_conciliacoes')
        .select(`
          *,
          conta:fin_contas(nome)
        `)
        .order('data_conciliacao', { ascending: false })
        .limit(20);
      setConciliacoes(data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLancamentosPendentes = async () => {
    const dataInicio = startOfMonth(new Date());
    const dataFim = endOfMonth(new Date());
    
    const { data } = await supabase
      .from('fin_lancamentos')
      .select('id, descricao, valor, tipo, data_lancamento')
      .eq('conta_origem_id', contaSelecionada)
      .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
      .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
      .is('deleted_at', null)
      .order('data_lancamento');
    
    setLancamentosPendentes(data || []);
  };

  const toggleLancamento = (id: string) => {
    const newSet = new Set(lancamentosSelecionados);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setLancamentosSelecionados(newSet);
  };

  const calcularSaldoSistema = () => {
    const conta = contas.find(c => c.id === contaSelecionada);
    return conta?.saldo_atual || 0;
  };

  const handleSubmit = async () => {
    if (!contaSelecionada) {
      toast.error('Selecione uma conta');
      return;
    }
    if (!formSaldoBanco) {
      toast.error('Informe o saldo do banco');
      return;
    }

    setSubmitting(true);
    try {
      const saldoSistema = calcularSaldoSistema();
      const saldoBanco = parseFloat(formSaldoBanco);
      const diferenca = saldoBanco - saldoSistema;

      const { error } = await supabase
        .from('fin_conciliacoes')
        .insert({
          conta_id: contaSelecionada,
          data_conciliacao: formDataConciliacao,
          saldo_banco: saldoBanco,
          saldo_sistema: saldoSistema,
          diferenca,
          status: Math.abs(diferenca) < 0.01 ? 'conciliado' : 'divergente',
          conciliado_por: user?.id,
          conciliado_em: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Conciliação registrada!');
      setShowDialog(false);
      setFormSaldoBanco('');
      fetchConciliacoes();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao registrar conciliação');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'conciliado':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Conciliado</Badge>;
      case 'divergente':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Divergente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowDialog(true)} disabled={!contaSelecionada}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conciliação
        </Button>
      </div>

      {/* Resumo da Conta */}
      {contaSelecionada && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Resumo da Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Saldo no Sistema</p>
                <p className="text-2xl font-bold">{formatCurrency(calcularSaldoSistema())}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Lançamentos do Mês</p>
                <p className="text-2xl font-bold">{lancamentosPendentes.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Última Conciliação</p>
                <p className="text-2xl font-bold">
                  {conciliacoes.find(c => c.conta_id === contaSelecionada)?.data_conciliacao
                    ? format(new Date(conciliacoes.find(c => c.conta_id === contaSelecionada)!.data_conciliacao), 'dd/MM/yyyy')
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lançamentos do Mês */}
      {contaSelecionada && lancamentosPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lançamentos do Mês</CardTitle>
            <CardDescription>
              Verifique os lançamentos que devem aparecer no extrato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={lancamentosSelecionados.size === lancamentosPendentes.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setLancamentosSelecionados(new Set(lancamentosPendentes.map(l => l.id)));
                        } else {
                          setLancamentosSelecionados(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentosPendentes.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Checkbox 
                        checked={lancamentosSelecionados.has(l.id)}
                        onCheckedChange={() => toggleLancamento(l.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(l.data_lancamento), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{l.descricao}</TableCell>
                    <TableCell>
                      <Badge variant={l.tipo === 'receita' ? 'default' : 'destructive'}>
                        {l.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      l.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {l.tipo === 'despesa' && '-'}
                      {formatCurrency(l.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Conciliações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Histórico de Conciliações</CardTitle>
              <CardDescription>
                Últimas conciliações realizadas
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchConciliacoes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : conciliacoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conciliação registrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Saldo Banco</TableHead>
                  <TableHead className="text-right">Saldo Sistema</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conciliacoes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {format(new Date(c.data_conciliacao), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{c.conta?.nome || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.saldo_banco)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.saldo_sistema)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      c.diferenca === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(c.diferenca)}
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Nova Conciliação */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conciliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data da Conciliação</Label>
              <Input
                type="date"
                value={formDataConciliacao}
                onChange={(e) => setFormDataConciliacao(e.target.value)}
              />
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Saldo no Sistema</p>
              <p className="text-xl font-bold">{formatCurrency(calcularSaldoSistema())}</p>
            </div>

            <div className="space-y-2">
              <Label>Saldo no Banco *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-10"
                  value={formSaldoBanco}
                  onChange={(e) => setFormSaldoBanco(e.target.value)}
                  placeholder="Informe o saldo do extrato"
                />
              </div>
            </div>

            {formSaldoBanco && (
              <div className={`p-4 rounded-lg ${
                Math.abs(parseFloat(formSaldoBanco) - calcularSaldoSistema()) < 0.01
                  ? 'bg-green-100 dark:bg-green-900/20'
                  : 'bg-red-100 dark:bg-red-900/20'
              }`}>
                <p className="text-sm">Diferença</p>
                <p className="text-xl font-bold">
                  {formatCurrency(parseFloat(formSaldoBanco || '0') - calcularSaldoSistema())}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar Conciliação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
