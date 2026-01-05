import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Target, TrendingUp, TrendingDown, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Meta {
  id: string;
  tipo: 'receita' | 'despesa' | 'economia';
  categoria_id: string | null;
  valor_meta: number;
  mes: number;
  ano: number;
  descricao: string | null;
  categoria?: { nome: string; cor: string } | null;
  valor_realizado?: number;
}

export function FinanceiroMetas() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string; cor: string }[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa' | 'economia'>('receita');
  const [formCategoriaId, setFormCategoriaId] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');

  useEffect(() => {
    fetchData();
  }, [mesSelecionado, anoSelecionado]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categorias
      const { data: cats } = await supabase
        .from('fin_categorias')
        .select('id, nome, tipo, cor')
        .eq('ativa', true);
      setCategorias(cats || []);

      // Fetch metas do mês
      const { data: metasData } = await supabase
        .from('fin_metas')
        .select(`
          *,
          categoria:fin_categorias(nome, cor)
        `)
        .eq('mes', mesSelecionado)
        .eq('ano', anoSelecionado);

      // Calcular valores realizados
      const dataInicio = startOfMonth(new Date(anoSelecionado, mesSelecionado - 1));
      const dataFim = endOfMonth(new Date(anoSelecionado, mesSelecionado - 1));

      const { data: lancamentos } = await supabase
        .from('fin_lancamentos')
        .select('tipo, categoria_id, valor')
        .gte('data_lancamento', format(dataInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(dataFim, 'yyyy-MM-dd'))
        .eq('status', 'pago')
        .is('deleted_at', null);

      const metasComRealizado = (metasData || []).map(meta => {
        let valorRealizado = 0;
        
        if (meta.categoria_id) {
          valorRealizado = lancamentos
            ?.filter(l => l.tipo === meta.tipo && l.categoria_id === meta.categoria_id)
            .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
        } else {
          valorRealizado = lancamentos
            ?.filter(l => l.tipo === meta.tipo)
            .reduce((acc, l) => acc + Number(l.valor), 0) || 0;
        }

        return {
          ...meta,
          tipo: meta.tipo as 'receita' | 'despesa' | 'economia',
          valor_realizado: valorRealizado
        };
      });

      setMetas(metasComRealizado as Meta[]);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (meta?: Meta) => {
    if (meta) {
      setEditingMeta(meta);
      setFormTipo(meta.tipo);
      setFormCategoriaId(meta.categoria_id || '');
      setFormValor(meta.valor_meta.toString());
      setFormDescricao(meta.descricao || '');
    } else {
      setEditingMeta(null);
      setFormTipo('receita');
      setFormCategoriaId('');
      setFormValor('');
      setFormDescricao('');
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formValor || parseFloat(formValor) <= 0) {
      toast.error('Valor da meta é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const metaData = {
        tipo: formTipo,
        categoria_id: formCategoriaId || null,
        valor_meta: parseFloat(formValor),
        mes: mesSelecionado,
        ano: anoSelecionado,
        descricao: formDescricao || null,
        created_by: user?.id
      };

      if (editingMeta) {
        const { error } = await supabase
          .from('fin_metas')
          .update(metaData)
          .eq('id', editingMeta.id);
        if (error) throw error;
        toast.success('Meta atualizada!');
      } else {
        const { error } = await supabase
          .from('fin_metas')
          .insert(metaData);
        if (error) throw error;
        toast.success('Meta criada!');
      }

      setShowDialog(false);
      fetchData();
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '23505') {
        toast.error('Já existe uma meta para este tipo/categoria neste mês');
      } else {
        toast.error('Erro ao salvar meta');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
    
    try {
      const { error } = await supabase
        .from('fin_metas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Meta excluída');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir meta');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getProgress = (meta: Meta) => {
    const realizado = meta.valor_realizado || 0;
    const progresso = (realizado / meta.valor_meta) * 100;
    return Math.min(progresso, 100);
  };

  const getProgressColor = (meta: Meta) => {
    const progresso = getProgress(meta);
    if (meta.tipo === 'despesa') {
      if (progresso > 100) return 'bg-red-500';
      if (progresso > 80) return 'bg-yellow-500';
      return 'bg-green-500';
    } else {
      if (progresso >= 100) return 'bg-green-500';
      if (progresso >= 50) return 'bg-yellow-500';
      return 'bg-red-500';
    }
  };

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const categoriasFiltradas = categorias.filter(c => c.tipo === formTipo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={mesSelecionado.toString()} onValueChange={(v) => setMesSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(a => (
                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Metas de Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metas.filter(m => m.tipo === 'receita').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Metas de Despesa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metas.filter(m => m.tipo === 'despesa').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Metas de Economia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metas.filter(m => m.tipo === 'economia').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Metas */}
      <Card>
        <CardHeader>
          <CardTitle>Metas do Período</CardTitle>
          <CardDescription>
            {meses.find(m => m.value === mesSelecionado)?.label} de {anoSelecionado}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : metas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma meta definida para este período</p>
              <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Meta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {metas.map(meta => (
                <div key={meta.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.tipo === 'receita' ? 'default' : meta.tipo === 'despesa' ? 'destructive' : 'secondary'}>
                        {meta.tipo}
                      </Badge>
                      {meta.categoria && (
                        <Badge variant="outline" style={{ borderColor: meta.categoria.cor }}>
                          {meta.categoria.nome}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(meta)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(meta.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {meta.descricao && (
                    <p className="text-sm text-muted-foreground mb-2">{meta.descricao}</p>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Realizado: {formatCurrency(meta.valor_realizado || 0)}</span>
                      <span>Meta: {formatCurrency(meta.valor_meta)}</span>
                    </div>
                    <Progress 
                      value={getProgress(meta)} 
                      className={`h-2 ${getProgressColor(meta)}`}
                    />
                    <div className="text-right text-sm text-muted-foreground">
                      {getProgress(meta).toFixed(1)}% atingido
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criar/Editar Meta */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMeta ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formTipo} onValueChange={(v) => setFormTipo(v as typeof formTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="economia">Economia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              <Select value={formCategoriaId} onValueChange={setFormCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
                  {categoriasFiltradas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor da Meta *</Label>
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
              <Label>Descrição</Label>
              <Input
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descrição da meta"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMeta ? 'Salvar' : 'Criar Meta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
