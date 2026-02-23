import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Pencil, Trash2, Search, X, BarChart3, ListFilter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate } from '@/lib/dateUtils';
import { FolgasDashboard } from './FolgasDashboard';

interface Folga {
  id: string;
  colaborador_id: string;
  data_folga: string;
  motivo: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  colaborador_nome?: string;
  criador_nome?: string;
}

interface Colaborador {
  id: string;
  full_name: string;
}

export function RHFolgas() {
  const [allFolgas, setAllFolgas] = useState<Folga[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolga, setEditingFolga] = useState<Folga | null>(null);

  // Advanced filters
  const [filtroDataDe, setFiltroDataDe] = useState('');
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [filtroColaborador, setFiltroColaborador] = useState('all');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [filtroAno, setFiltroAno] = useState(String(new Date().getFullYear()));

  // Form state
  const [formColaboradorId, setFormColaboradorId] = useState('');
  const [formDataFolga, setFormDataFolga] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchColaboradores();
    fetchAllFolgas();
  }, []);

  const fetchColaboradores = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .order('full_name');
    if (!error && data) setColaboradores(data);
  };

  const fetchAllFolgas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rh_folgas')
        .select('*')
        .order('data_folga', { ascending: false });
      if (error) throw error;

      const userIds = new Set<string>();
      (data || []).forEach(f => {
        userIds.add(f.colaborador_id);
        if (f.created_by) userIds.add(f.created_by);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });

      const folgasComNomes = (data || []).map(f => ({
        ...f,
        colaborador_nome: profileMap[f.colaborador_id] || 'Desconhecido',
        criador_nome: f.created_by ? profileMap[f.created_by] || '-' : '-',
      }));

      setAllFolgas(folgasComNomes);
    } catch {
      toast.error('Erro ao carregar folgas');
    } finally {
      setLoading(false);
    }
  };

  // Filtered folgas for Registros tab
  const filteredFolgas = allFolgas.filter(f => {
    if (filtroAno && !filtroDataDe && !filtroDataAte) {
      if (!f.data_folga.startsWith(filtroAno)) return false;
    }
    if (filtroDataDe && f.data_folga < filtroDataDe) return false;
    if (filtroDataAte && f.data_folga > filtroDataAte) return false;
    if (filtroColaborador !== 'all' && f.colaborador_id !== filtroColaborador) return false;
    if (filtroMotivo && !(f.motivo || '').toLowerCase().includes(filtroMotivo.toLowerCase())) return false;
    return true;
  });

  const clearFilters = () => {
    setFiltroDataDe('');
    setFiltroDataAte('');
    setFiltroColaborador('all');
    setFiltroMotivo('');
    setFiltroAno(String(new Date().getFullYear()));
  };

  const resetForm = () => {
    setFormColaboradorId('');
    setFormDataFolga('');
    setFormMotivo('');
    setFormObservacoes('');
    setEditingFolga(null);
  };

  const openEditDialog = (folga: Folga) => {
    setEditingFolga(folga);
    setFormColaboradorId(folga.colaborador_id);
    setFormDataFolga(folga.data_folga);
    setFormMotivo(folga.motivo || '');
    setFormObservacoes(folga.observacoes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formColaboradorId || !formDataFolga) {
      toast.error('Preencha o colaborador e a data');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editingFolga) {
        const { error } = await supabase
          .from('rh_folgas')
          .update({
            colaborador_id: formColaboradorId,
            data_folga: formDataFolga,
            motivo: formMotivo || null,
            observacoes: formObservacoes || null,
          })
          .eq('id', editingFolga.id);
        if (error) throw error;
        toast.success('Folga atualizada');
      } else {
        const { error } = await supabase
          .from('rh_folgas')
          .insert({
            colaborador_id: formColaboradorId,
            data_folga: formDataFolga,
            motivo: formMotivo || null,
            observacoes: formObservacoes || null,
            created_by: user?.id,
          });
        if (error) {
          if (error.code === '23505') {
            toast.error('Já existe uma folga cadastrada para este colaborador nesta data');
            return;
          }
          throw error;
        }
        toast.success('Folga cadastrada');
      }
      setDialogOpen(false);
      resetForm();
      fetchAllFolgas();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta folga?')) return;
    const { error } = await supabase.from('rh_folgas').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Folga excluída');
      fetchAllFolgas();
    }
  };

  const availableYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Gestão de Folgas
        </h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Folga</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFolga ? 'Editar Folga' : 'Cadastrar Folga'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select value={formColaboradorId} onValueChange={setFormColaboradorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data da Folga *</Label>
                <Input type="date" value={formDataFolga} onChange={e => setFormDataFolga(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Input placeholder="Ex: Batimento de metas, prêmio..." value={formMotivo} onChange={e => setFormMotivo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Observações adicionais (opcional)" value={formObservacoes} onChange={e => setFormObservacoes(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Salvando...' : editingFolga ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="registros" className="gap-2"><ListFilter className="h-4 w-4" /> Registros</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FolgasDashboard folgas={allFolgas} loading={loading} />
        </TabsContent>

        <TabsContent value="registros">
          <div className="space-y-4">
            {/* Advanced Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Ano</Label>
                    <Select value={filtroAno} onValueChange={setFiltroAno}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Colaborador</Label>
                    <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {colaboradores.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo</Label>
                    <Input placeholder="Buscar motivo..." value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3 w-3" /> Limpar filtros
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Folgas Cadastradas ({filteredFolgas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : filteredFolgas.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma folga encontrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Cadastrado por</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFolgas.map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.colaborador_nome}</TableCell>
                          <TableCell>{formatLocalDate(f.data_folga)}</TableCell>
                          <TableCell>
                            {f.motivo ? <Badge variant="secondary">{f.motivo}</Badge> : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{f.criador_nome}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(f)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
