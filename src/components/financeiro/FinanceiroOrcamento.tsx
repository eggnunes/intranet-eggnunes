import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { 
  Calculator, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Copy
} from 'lucide-react';

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
}

interface Orcamento {
  id: string;
  categoria_id: string;
  mes: number;
  ano: number;
  valor_planejado: number;
  observacao: string | null;
  categoria?: { nome: string; cor: string; tipo: string };
}

interface OrcamentoComRealizado extends Orcamento {
  valor_realizado: number;
  percentual: number;
  diferenca: number;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function FinanceiroOrcamento() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoComRealizado[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [showDialog, setShowDialog] = useState(false);
  const [editando, setEditando] = useState<Orcamento | null>(null);
  const [formData, setFormData] = useState({
    categoria_id: '',
    valor_planejado: '',
    observacao: ''
  });

  useEffect(() => {
    fetchCategorias();
  }, []);

  useEffect(() => {
    fetchOrcamentos();
  }, [mesSelecionado, anoSelecionado]);

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from('fin_categorias')
      .select('id, nome, tipo, cor')
      .eq('ativa', true)
      .order('nome');
    setCategorias(data || []);
  };

  const fetchOrcamentos = async () => {
    setLoading(true);
    try {
      // Buscar orçamentos do mês
      const { data: orcamentosData } = await supabase
        .from('fin_orcamentos')
        .select('*, categoria:fin_categorias(nome, cor, tipo)')
        .eq('mes', mesSelecionado)
        .eq('ano', anoSelecionado);

      // Buscar lançamentos realizados no mês
      const dataInicio = startOfMonth(new Date(anoSelecionado, mesSelecionado - 1));
      const dataFim = endOfMonth(new Date(anoSelecionado, mesSelecionado - 1));

      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('categoria_id, valor, tipo')
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Calcular realizados por categoria
      const realizadosPorCategoria = new Map<string, number>();
      lancamentos?.forEach(l => {
        if (l.categoria_id) {
          const atual = realizadosPorCategoria.get(l.categoria_id) || 0;
          realizadosPorCategoria.set(l.categoria_id, atual + Number(l.valor));
        }
      });

      // Combinar orçamentos com realizados
      const orcamentosComRealizado: OrcamentoComRealizado[] = (orcamentosData || []).map(o => {
        const realizado = realizadosPorCategoria.get(o.categoria_id) || 0;
        const planejado = Number(o.valor_planejado);
        return {
          ...o,
          valor_realizado: realizado,
          percentual: planejado > 0 ? (realizado / planejado) * 100 : 0,
          diferenca: planejado - realizado
        };
      });

      setOrcamentos(orcamentosComRealizado);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.categoria_id || !formData.valor_planejado) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from('fin_orcamentos')
          .update({
            valor_planejado: parseFloat(formData.valor_planejado),
            observacao: formData.observacao || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editando.id);

        if (error) throw error;
        toast.success('Orçamento atualizado!');
      } else {
        const { error } = await supabase
          .from('fin_orcamentos')
          .insert({
            categoria_id: formData.categoria_id,
            mes: mesSelecionado,
            ano: anoSelecionado,
            valor_planejado: parseFloat(formData.valor_planejado),
            observacao: formData.observacao || null,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success('Orçamento criado!');
      }

      setShowDialog(false);
      setEditando(null);
      setFormData({ categoria_id: '', valor_planejado: '', observacao: '' });
      fetchOrcamentos();
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error);
      if (error.code === '23505') {
        toast.error('Já existe um orçamento para esta categoria neste mês');
      } else {
        toast.error('Erro ao salvar orçamento');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (orcamento: OrcamentoComRealizado) => {
    setEditando(orcamento);
    setFormData({
      categoria_id: orcamento.categoria_id,
      valor_planejado: orcamento.valor_planejado.toString(),
      observacao: orcamento.observacao || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este orçamento?')) return;

    try {
      const { error } = await supabase
        .from('fin_orcamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Orçamento excluído!');
      fetchOrcamentos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir orçamento');
    }
  };

  const handleCopiarMesAnterior = async () => {
    const mesAnterior = mesSelecionado === 1 ? 12 : mesSelecionado - 1;
    const anoAnterior = mesSelecionado === 1 ? anoSelecionado - 1 : anoSelecionado;

    try {
      const { data: orcamentosAnteriores } = await supabase
        .from('fin_orcamentos')
        .select('*')
        .eq('mes', mesAnterior)
        .eq('ano', anoAnterior);

      if (!orcamentosAnteriores || orcamentosAnteriores.length === 0) {
        toast.error('Não há orçamentos no mês anterior para copiar');
        return;
      }

      const novosOrcamentos = orcamentosAnteriores.map(o => ({
        categoria_id: o.categoria_id,
        mes: mesSelecionado,
        ano: anoSelecionado,
        valor_planejado: o.valor_planejado,
        observacao: o.observacao,
        created_by: user?.id
      }));

      const { error } = await supabase
        .from('fin_orcamentos')
        .insert(novosOrcamentos);

      if (error) throw error;
      toast.success(`${novosOrcamentos.length} orçamentos copiados!`);
      fetchOrcamentos();
    } catch (error: any) {
      console.error('Erro ao copiar:', error);
      if (error.code === '23505') {
        toast.error('Alguns orçamentos já existem para este mês');
      } else {
        toast.error('Erro ao copiar orçamentos');
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (percentual: number, tipo: string) => {
    // Para despesas: abaixo do orçamento é bom
    // Para receitas: acima do orçamento é bom
    const isDespesa = tipo === 'despesa';
    
    if (isDespesa) {
      if (percentual <= 80) return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Sob controle</Badge>;
      if (percentual <= 100) return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>;
      return <Badge variant="destructive"><TrendingUp className="h-3 w-3 mr-1" />Acima</Badge>;
    } else {
      if (percentual >= 100) return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Meta atingida</Badge>;
      if (percentual >= 80) return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Próximo</Badge>;
      return <Badge variant="destructive"><TrendingDown className="h-3 w-3 mr-1" />Abaixo</Badge>;
    }
  };

  const totalPlanejado = orcamentos.reduce((acc, o) => acc + Number(o.valor_planejado), 0);
  const totalRealizado = orcamentos.reduce((acc, o) => acc + o.valor_realizado, 0);

  const chartData = orcamentos.map(o => ({
    nome: o.categoria?.nome || 'Sem categoria',
    planejado: Number(o.valor_planejado),
    realizado: o.valor_realizado,
    cor: o.categoria?.cor || '#888'
  }));

  const categoriasDisponiveis = categorias.filter(
    c => !orcamentos.some(o => o.categoria_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Filtros e ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={mesSelecionado.toString()} onValueChange={(v) => setMesSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((mes, index) => (
                <SelectItem key={index} value={(index + 1).toString()}>{mes}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(ano => (
                <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopiarMesAnterior}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Mês Anterior
          </Button>
          <Button onClick={() => { setEditando(null); setFormData({ categoria_id: '', valor_planejado: '', observacao: '' }); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Planejado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPlanejado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRealizado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Diferença</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPlanejado - totalRealizado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPlanejado - totalRealizado)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico comparativo */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Planejado vs Realizado</CardTitle>
            <CardDescription>Comparação por categoria em {MESES[mesSelecionado - 1]}/{anoSelecionado}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="planejado" name="Planejado" fill="#94A3B8" />
                  <Bar dataKey="realizado" name="Realizado" fill="#3B82F6">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de orçamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Orçamentos de {MESES[mesSelecionado - 1]}/{anoSelecionado}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : orcamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum orçamento definido para este mês</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro orçamento
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Planejado</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentos.map(o => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: o.categoria?.cor || '#888' }}
                        />
                        <span className="font-medium">{o.categoria?.nome || 'Sem categoria'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(o.valor_planejado)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.valor_realizado)}</TableCell>
                    <TableCell className={`text-right font-medium ${o.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(o.diferenca)}
                    </TableCell>
                    <TableCell>
                      <div className="w-[100px]">
                        <Progress value={Math.min(o.percentual, 100)} className="h-2" />
                        <span className="text-xs text-muted-foreground">{o.percentual.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(o.percentual, o.categoria?.tipo || 'despesa')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(o)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
            <DialogDescription>
              {editando ? 'Atualize os valores do orçamento' : `Defina o orçamento para ${MESES[mesSelecionado - 1]}/${anoSelecionado}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select 
                value={formData.categoria_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, categoria_id: v }))}
                disabled={!!editando}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(editando ? categorias : categoriasDisponiveis).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
                        {c.nome}
                        <Badge variant="outline" className="ml-2">{c.tipo}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Planejado *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-10"
                  value={formData.valor_planejado}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_planejado: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                placeholder="Observação opcional"
                value={formData.observacao}
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
