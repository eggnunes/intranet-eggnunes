import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Loader2,
  Calendar,
  Play,
  Pause
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths, addWeeks, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Recorrencia {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria_id: string | null;
  conta_id: string | null;
  cliente_id: string | null;
  setor_id: string | null;
  valor: number;
  descricao: string;
  dia_vencimento: number | null;
  frequencia: string;
  data_inicio: string;
  data_fim: string | null;
  proxima_geracao: string | null;
  ativo: boolean;
  categoria?: { nome: string } | null;
  conta?: { nome: string } | null;
}

export function FinanceiroRecorrencias() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecorrencia, setEditingRecorrencia] = useState<Recorrencia | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formCategoriaId, setFormCategoriaId] = useState('');
  const [formContaId, setFormContaId] = useState('');
  const [formClienteId, setFormClienteId] = useState('');
  const [formSetorId, setFormSetorId] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formDiaVencimento, setFormDiaVencimento] = useState('');
  const [formFrequencia, setFormFrequencia] = useState('mensal');
  const [formDataInicio, setFormDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [formDataFim, setFormDataFim] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, catRes, contaRes, clienteRes, setorRes] = await Promise.all([
        supabase
          .from('fin_recorrencias')
          .select(`
            *,
            categoria:fin_categorias(nome),
            conta:fin_contas(nome)
          `)
          .order('descricao'),
        supabase.from('fin_categorias').select('id, nome, tipo').eq('ativa', true),
        supabase.from('fin_contas').select('id, nome').eq('ativa', true),
        supabase.from('fin_clientes').select('id, nome').eq('ativo', true),
        supabase.from('fin_setores').select('id, nome').eq('ativo', true)
      ]);

      setRecorrencias((recRes.data || []).map(r => ({
        ...r,
        tipo: r.tipo as 'receita' | 'despesa'
      })));
      setCategorias(catRes.data || []);
      setContas(contaRes.data || []);
      setClientes(clienteRes.data || []);
      setSetores(setorRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (recorrencia?: Recorrencia) => {
    if (recorrencia) {
      setEditingRecorrencia(recorrencia);
      setFormTipo(recorrencia.tipo);
      setFormCategoriaId(recorrencia.categoria_id || '');
      setFormContaId(recorrencia.conta_id || '');
      setFormClienteId(recorrencia.cliente_id || '');
      setFormSetorId(recorrencia.setor_id || '');
      setFormValor(recorrencia.valor.toString());
      setFormDescricao(recorrencia.descricao);
      setFormDiaVencimento(recorrencia.dia_vencimento?.toString() || '');
      setFormFrequencia(recorrencia.frequencia);
      setFormDataInicio(recorrencia.data_inicio);
      setFormDataFim(recorrencia.data_fim || '');
    } else {
      setEditingRecorrencia(null);
      setFormTipo('despesa');
      setFormCategoriaId('');
      setFormContaId('');
      setFormClienteId('');
      setFormSetorId('');
      setFormValor('');
      setFormDescricao('');
      setFormDiaVencimento('');
      setFormFrequencia('mensal');
      setFormDataInicio(new Date().toISOString().split('T')[0]);
      setFormDataFim('');
    }
    setShowDialog(true);
  };

  const calcularProximaGeracao = (dataInicio: string, frequencia: string): string => {
    const hoje = new Date();
    let data = new Date(dataInicio);
    
    while (data <= hoje) {
      switch (frequencia) {
        case 'semanal':
          data = addWeeks(data, 1);
          break;
        case 'quinzenal':
          data = addDays(data, 15);
          break;
        case 'mensal':
          data = addMonths(data, 1);
          break;
        case 'bimestral':
          data = addMonths(data, 2);
          break;
        case 'trimestral':
          data = addMonths(data, 3);
          break;
        case 'semestral':
          data = addMonths(data, 6);
          break;
        case 'anual':
          data = addMonths(data, 12);
          break;
      }
    }
    
    return format(data, 'yyyy-MM-dd');
  };

  const handleSubmit = async () => {
    if (!formDescricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (!formValor || parseFloat(formValor) <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    setSubmitting(true);
    try {
      const proximaGeracao = calcularProximaGeracao(formDataInicio, formFrequencia);
      
      const recorrenciaData = {
        tipo: formTipo,
        categoria_id: formCategoriaId || null,
        conta_id: formContaId || null,
        cliente_id: formClienteId || null,
        setor_id: formSetorId || null,
        valor: parseFloat(formValor),
        descricao: formDescricao.trim(),
        dia_vencimento: formDiaVencimento ? parseInt(formDiaVencimento) : null,
        frequencia: formFrequencia,
        data_inicio: formDataInicio,
        data_fim: formDataFim || null,
        proxima_geracao: proximaGeracao,
        ativo: true,
        created_by: user?.id
      };

      if (editingRecorrencia) {
        const { error } = await supabase
          .from('fin_recorrencias')
          .update(recorrenciaData)
          .eq('id', editingRecorrencia.id);
        if (error) throw error;
        toast.success('Recorrência atualizada!');
      } else {
        const { error } = await supabase
          .from('fin_recorrencias')
          .insert(recorrenciaData);
        if (error) throw error;
        toast.success('Recorrência criada!');
      }

      setShowDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar recorrência');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('fin_recorrencias')
        .update({ ativo: !ativo })
        .eq('id', id);
      if (error) throw error;
      toast.success(ativo ? 'Recorrência pausada' : 'Recorrência ativada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta recorrência?')) return;
    
    try {
      const { error } = await supabase
        .from('fin_recorrencias')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Recorrência excluída');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const gerarLancamento = async (recorrencia: Recorrencia) => {
    try {
      const lancamento = {
        tipo: recorrencia.tipo,
        categoria_id: recorrencia.categoria_id,
        conta_origem_id: recorrencia.conta_id,
        cliente_id: recorrencia.cliente_id,
        setor_id: recorrencia.setor_id,
        valor: recorrencia.valor,
        descricao: `[REC] ${recorrencia.descricao}`,
        data_lancamento: new Date().toISOString().split('T')[0],
        data_vencimento: recorrencia.proxima_geracao,
        status: 'pendente',
        recorrencia_id: recorrencia.id,
        created_by: user?.id
      };

      const { error: lancError } = await supabase
        .from('fin_lancamentos')
        .insert(lancamento);
      
      if (lancError) throw lancError;

      // Atualizar próxima geração
      const novaProxima = calcularProximaGeracao(
        recorrencia.proxima_geracao || recorrencia.data_inicio, 
        recorrencia.frequencia
      );
      
      await supabase
        .from('fin_recorrencias')
        .update({ proxima_geracao: novaProxima })
        .eq('id', recorrencia.id);

      toast.success('Lançamento gerado com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao gerar lançamento');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getFrequenciaLabel = (freq: string) => {
    const labels: Record<string, string> = {
      semanal: 'Semanal',
      quinzenal: 'Quinzenal',
      mensal: 'Mensal',
      bimestral: 'Bimestral',
      trimestral: 'Trimestral',
      semestral: 'Semestral',
      anual: 'Anual'
    };
    return labels[freq] || freq;
  };

  const categoriasFiltradas = categorias.filter(c => c.tipo === formTipo);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lançamentos Recorrentes</CardTitle>
              <CardDescription>
                Configure receitas e despesas que se repetem automaticamente
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Recorrência
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : recorrencias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma recorrência configurada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Próximo</TableHead>
                  <TableHead className="w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recorrencias.map(rec => (
                  <TableRow key={rec.id} className={!rec.ativo ? 'opacity-50' : ''}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAtivo(rec.id, rec.ativo)}
                        title={rec.ativo ? 'Pausar' : 'Ativar'}
                      >
                        {rec.ativo ? (
                          <Pause className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Play className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rec.tipo === 'receita' ? 'default' : 'destructive'}>
                        {rec.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{rec.descricao}</TableCell>
                    <TableCell>{rec.categoria?.nome || '-'}</TableCell>
                    <TableCell>{getFrequenciaLabel(rec.frequencia)}</TableCell>
                    <TableCell className={`text-right font-medium ${
                      rec.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(rec.valor)}
                    </TableCell>
                    <TableCell>
                      {rec.proxima_geracao ? format(new Date(rec.proxima_geracao), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => gerarLancamento(rec)}
                          title="Gerar lançamento agora"
                          disabled={!rec.ativo}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(rec)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rec.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecorrencia ? 'Editar Recorrência' : 'Nova Recorrência'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formTipo} onValueChange={(v) => setFormTipo(v as 'receita' | 'despesa')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={formFrequencia} onValueChange={setFormFrequencia}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="bimestral">Bimestral</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Aluguel do escritório"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-10"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dia do Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formDiaVencimento}
                  onChange={(e) => setFormDiaVencimento(e.target.value)}
                  placeholder="1-31"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formCategoriaId} onValueChange={setFormCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={formContaId} onValueChange={setFormContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRecorrencia ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
