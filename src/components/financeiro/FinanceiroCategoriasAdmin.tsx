import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Search, AlertTriangle, Loader2, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Categoria {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  grupo: string | null;
  descricao: string | null;
  cor: string | null;
  ativa: boolean;
  _count?: number;
}

interface Subcategoria {
  id: string;
  nome: string;
  categoria_id: string;
  descricao: string;
  ativa: boolean;
  _count?: number;
}

export function FinanceiroCategoriasAdmin() {
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  
  // Dialog states
  const [showCategoriaDialog, setShowCategoriaDialog] = useState(false);
  const [showSubcategoriaDialog, setShowSubcategoriaDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [editingSubcategoria, setEditingSubcategoria] = useState<Subcategoria | null>(null);
  const [movingSubcategoria, setMovingSubcategoria] = useState<Subcategoria | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'categoria' | 'subcategoria'; item: Categoria | Subcategoria } | null>(null);
  const [deleteAction, setDeleteAction] = useState<'move' | 'inactivate'>('inactivate');
  const [moveToId, setMoveToId] = useState('');
  
  // Form states
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formGrupo, setFormGrupo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCor, setFormCor] = useState('#6B7280');
  const [formCategoriaId, setFormCategoriaId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categorias with count
      const { data: cats } = await supabase
        .from('fin_categorias')
        .select('*')
        .order('tipo')
        .order('ordem');

      // Fetch subcategorias
      const { data: subs } = await supabase
        .from('fin_subcategorias')
        .select('*')
        .order('nome');

      // Count lancamentos per categoria
      const { data: catCounts } = await supabase
        .from('fin_lancamentos')
        .select('categoria_id')
        .is('deleted_at', null);

      const countMap = new Map<string, number>();
      catCounts?.forEach(l => {
        if (l.categoria_id) {
          countMap.set(l.categoria_id, (countMap.get(l.categoria_id) || 0) + 1);
        }
      });

      // Count lancamentos per subcategoria
      const { data: subCounts } = await supabase
        .from('fin_lancamentos')
        .select('subcategoria_id')
        .is('deleted_at', null);

      const subCountMap = new Map<string, number>();
      subCounts?.forEach(l => {
        if (l.subcategoria_id) {
          subCountMap.set(l.subcategoria_id, (subCountMap.get(l.subcategoria_id) || 0) + 1);
        }
      });

      setCategorias((cats || []).map(c => ({
        ...c,
        tipo: c.tipo as 'receita' | 'despesa',
        _count: countMap.get(c.id) || 0
      })));

      setSubcategorias((subs || []).map(s => ({
        ...s,
        _count: subCountMap.get(s.id) || 0
      })));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const filteredCategorias = categorias.filter(c => {
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const openCategoriaDialog = (categoria?: Categoria) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormNome(categoria.nome);
      setFormTipo(categoria.tipo as 'receita' | 'despesa');
      setFormGrupo(categoria.grupo || '');
      setFormDescricao(categoria.descricao || '');
      setFormCor(categoria.cor || '#6B7280');
    } else {
      setEditingCategoria(null);
      setFormNome('');
      setFormTipo('despesa');
      setFormGrupo('');
      setFormDescricao('');
      setFormCor('#6B7280');
    }
    setShowCategoriaDialog(true);
  };

  const openSubcategoriaDialog = (categoriaId: string, subcategoria?: Subcategoria) => {
    setFormCategoriaId(categoriaId);
    if (subcategoria) {
      setEditingSubcategoria(subcategoria);
      setFormNome(subcategoria.nome);
      setFormDescricao(subcategoria.descricao || '');
    } else {
      setEditingSubcategoria(null);
      setFormNome('');
      setFormDescricao('');
    }
    setShowSubcategoriaDialog(true);
  };

  const handleSaveCategoria = async () => {
    if (!formNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategoria) {
        const { error } = await supabase
          .from('fin_categorias')
          .update({
            nome: formNome.trim(),
            tipo: formTipo,
            grupo: formGrupo.trim() || null,
            descricao: formDescricao.trim() || null,
            cor: formCor
          })
          .eq('id', editingCategoria.id);

        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase
          .from('fin_categorias')
          .insert({
            nome: formNome.trim(),
            tipo: formTipo,
            grupo: formGrupo.trim() || null,
            descricao: formDescricao.trim() || null,
            cor: formCor
          });

        if (error) throw error;
        toast.success('Categoria criada');
      }

      setShowCategoriaDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast.error('Erro ao salvar categoria');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSubcategoria = async () => {
    if (!formNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSubcategoria) {
        const { error } = await supabase
          .from('fin_subcategorias')
          .update({
            nome: formNome.trim(),
            descricao: formDescricao.trim() || null
          })
          .eq('id', editingSubcategoria.id);

        if (error) throw error;
        toast.success('Subcategoria atualizada');
      } else {
        const { error } = await supabase
          .from('fin_subcategorias')
          .insert({
            nome: formNome.trim(),
            categoria_id: formCategoriaId,
            descricao: formDescricao.trim() || null
          });

        if (error) throw error;
        toast.success('Subcategoria criada');
      }

      setShowSubcategoriaDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar subcategoria:', error);
      toast.error('Erro ao salvar subcategoria');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (type: 'categoria' | 'subcategoria', item: Categoria | Subcategoria) => {
    setDeletingItem({ type, item });
    setDeleteAction('inactivate');
    setMoveToId('');
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    setSubmitting(true);
    try {
      const count = deletingItem.item._count || 0;
      
      if (count > 0) {
        if (deleteAction === 'move' && moveToId) {
          // Move lançamentos para outra categoria/subcategoria
          const field = deletingItem.type === 'categoria' ? 'categoria_id' : 'subcategoria_id';
          await supabase
            .from('fin_lancamentos')
            .update({ [field]: moveToId })
            .eq(field, deletingItem.item.id);
          
          // Agora pode deletar
          await supabase
            .from(deletingItem.type === 'categoria' ? 'fin_categorias' : 'fin_subcategorias')
            .delete()
            .eq('id', deletingItem.item.id);
          
          toast.success(`${deletingItem.type === 'categoria' ? 'Categoria' : 'Subcategoria'} excluída e lançamentos movidos`);
        } else {
          // Inativar
          await supabase
            .from(deletingItem.type === 'categoria' ? 'fin_categorias' : 'fin_subcategorias')
            .update({ ativa: false })
            .eq('id', deletingItem.item.id);
          
          toast.success(`${deletingItem.type === 'categoria' ? 'Categoria' : 'Subcategoria'} inativada`);
        }
      } else {
        // Pode deletar direto
        await supabase
          .from(deletingItem.type === 'categoria' ? 'fin_categorias' : 'fin_subcategorias')
          .delete()
          .eq('id', deletingItem.item.id);
        
        toast.success(`${deletingItem.type === 'categoria' ? 'Categoria' : 'Subcategoria'} excluída`);
      }

      setShowDeleteDialog(false);
      setDeletingItem(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAtiva = async (type: 'categoria' | 'subcategoria', id: string, ativa: boolean) => {
    try {
      await supabase
        .from(type === 'categoria' ? 'fin_categorias' : 'fin_subcategorias')
        .update({ ativa: !ativa })
        .eq('id', id);
      
      toast.success(`${type === 'categoria' ? 'Categoria' : 'Subcategoria'} ${ativa ? 'inativada' : 'ativada'}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const openMoveDialog = (subcategoria: Subcategoria) => {
    setMovingSubcategoria(subcategoria);
    setFormCategoriaId('');
    setShowMoveDialog(true);
  };

  const handleMoveSubcategoria = async () => {
    if (!movingSubcategoria || !formCategoriaId) {
      toast.error('Selecione a categoria de destino');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('fin_subcategorias')
        .update({ categoria_id: formCategoriaId })
        .eq('id', movingSubcategoria.id);

      if (error) throw error;

      const destCategoria = categorias.find(c => c.id === formCategoriaId);
      toast.success(`Subcategoria movida para ${destCategoria?.nome || 'nova categoria'}`);
      setShowMoveDialog(false);
      setMovingSubcategoria(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao mover subcategoria:', error);
      toast.error('Erro ao mover subcategoria');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Categorias</CardTitle>
            <CardDescription>Gerencie as categorias de receitas e despesas</CardDescription>
          </div>
          <Button onClick={() => openCategoriaDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCategorias.map((cat) => {
              const subs = subcategorias.filter(s => s.categoria_id === cat.id);
              const isExpanded = expanded.has(cat.id);

              return (
                <Collapsible key={cat.id} open={isExpanded} onOpenChange={() => toggleExpanded(cat.id)}>
                  <div className={`border rounded-lg ${!cat.ativa ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.cor }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cat.nome}</span>
                            <Badge variant={cat.tipo === 'receita' ? 'default' : 'secondary'}>
                              {cat.tipo}
                            </Badge>
                            {!cat.ativa && <Badge variant="outline">Inativa</Badge>}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {subs.length} subcategorias · {cat._count || 0} lançamentos
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openSubcategoriaDialog(cat.id)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openCategoriaDialog(cat)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog('categoria', cat)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      {subs.length > 0 ? (
                        <div className="border-t">
                          <Table>
                            <TableBody>
                              {subs.map((sub) => (
                                <TableRow key={sub.id} className={!sub.ativa ? 'opacity-50' : ''}>
                                  <TableCell className="pl-12">{sub.nome}</TableCell>
                                  <TableCell>{sub.descricao || '-'}</TableCell>
                                  <TableCell className="text-right">{sub._count || 0} lançamentos</TableCell>
                                  <TableCell className="w-[130px]">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => openMoveDialog(sub)} title="Mover para outra categoria">
                                        <ArrowRightLeft className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => openSubcategoriaDialog(cat.id, sub)}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog('subcategoria', sub)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="border-t p-4 text-center text-muted-foreground text-sm">
                          Nenhuma subcategoria cadastrada
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog Categoria */}
      <Dialog open={showCategoriaDialog} onOpenChange={setShowCategoriaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formTipo} onValueChange={(v) => setFormTipo(v as typeof formTipo)}>
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
              <Label>Grupo</Label>
              <Input value={formGrupo} onChange={(e) => setFormGrupo(e.target.value)} placeholder="Ex: Honorários, Pessoal" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input type="color" value={formCor} onChange={(e) => setFormCor(e.target.value)} className="w-16 h-10 p-1" />
                <Input value={formCor} onChange={(e) => setFormCor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoriaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategoria} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Subcategoria */}
      <Dialog open={showSubcategoriaDialog} onOpenChange={setShowSubcategoriaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategoria ? 'Editar Subcategoria' : 'Nova Subcategoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubcategoriaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveSubcategoria} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {deletingItem?.item._count ? 'Não é possível excluir diretamente' : 'Confirmar exclusão'}
            </DialogTitle>
            <DialogDescription>
              {deletingItem?.item._count ? (
                <>
                  Esta {deletingItem.type === 'categoria' ? 'categoria' : 'subcategoria'} possui{' '}
                  <strong>{deletingItem.item._count} lançamentos</strong> vinculados.
                </>
              ) : (
                `Deseja excluir a ${deletingItem?.type === 'categoria' ? 'categoria' : 'subcategoria'} "${deletingItem?.item.nome}"?`
              )}
            </DialogDescription>
          </DialogHeader>

          {deletingItem?.item._count ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deleteAction"
                    checked={deleteAction === 'inactivate'}
                    onChange={() => setDeleteAction('inactivate')}
                  />
                  Inativar {deletingItem.type === 'categoria' ? 'categoria' : 'subcategoria'}
                </Label>
                <p className="text-sm text-muted-foreground ml-5">
                  Não aparecerá mais no dropdown, mas os lançamentos históricos serão mantidos
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deleteAction"
                    checked={deleteAction === 'move'}
                    onChange={() => setDeleteAction('move')}
                  />
                  Mover lançamentos para outra {deletingItem.type === 'categoria' ? 'categoria' : 'subcategoria'}
                </Label>
                {deleteAction === 'move' && (
                  <Select value={moveToId} onValueChange={setMoveToId}>
                    <SelectTrigger className="ml-5">
                      <SelectValue placeholder="Selecione o destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {(deletingItem.type === 'categoria' 
                        ? categorias.filter(c => c.id !== deletingItem.item.id && c.tipo === (deletingItem.item as Categoria).tipo)
                        : subcategorias.filter(s => s.id !== deletingItem.item.id && s.categoria_id === (deletingItem.item as Subcategoria).categoria_id)
                      ).map(item => (
                        <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={submitting || (deleteAction === 'move' && !moveToId)}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deletingItem?.item._count ? (deleteAction === 'move' ? 'Mover e Excluir' : 'Inativar') : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mover Subcategoria */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Mover Subcategoria
            </DialogTitle>
            <DialogDescription>
              Mover "{movingSubcategoria?.nome}" para outra categoria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria de Destino *</Label>
              <Select value={formCategoriaId} onValueChange={setFormCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias
                    .filter(c => c.id !== movingSubcategoria?.categoria_id && c.ativa)
                    .map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.cor }} />
                          {cat.nome}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {cat.tipo}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button>
            <Button onClick={handleMoveSubcategoria} disabled={submitting || !formCategoriaId}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mover Subcategoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
