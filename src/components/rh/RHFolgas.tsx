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
import { Calendar, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

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
  const [folgas, setFolgas] = useState<Folga[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolga, setEditingFolga] = useState<Folga | null>(null);
  const [filtroColaborador, setFiltroColaborador] = useState('all');
  const [filtroMes, setFiltroMes] = useState(format(new Date(), 'yyyy-MM'));

  // Form state
  const [formColaboradorId, setFormColaboradorId] = useState('');
  const [formDataFolga, setFormDataFolga] = useState('');
  const [formMotivo, setFormMotivo] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  useEffect(() => {
    fetchFolgas();
  }, [filtroColaborador, filtroMes]);

  const fetchColaboradores = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('approval_status', 'approved')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) setColaboradores(data);
  };

  const fetchFolgas = async () => {
    setLoading(true);
    try {
      const startDate = filtroMes + '-01';
      const endDate = filtroMes + '-31';

      let query = supabase
        .from('rh_folgas')
        .select('*')
        .gte('data_folga', startDate)
        .lte('data_folga', endDate)
        .order('data_folga', { ascending: false });

      if (filtroColaborador !== 'all') {
        query = query.eq('colaborador_id', filtroColaborador);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profile names in bulk
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

      setFolgas(folgasComNomes);
    } catch (error: any) {
      toast.error('Erro ao carregar folgas');
    } finally {
      setLoading(false);
    }
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
      fetchFolgas();
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
      fetchFolgas();
    }
  };

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
                <Input
                  placeholder="Ex: Batimento de metas, prêmio..."
                  value={formMotivo}
                  onChange={e => setFormMotivo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais (opcional)"
                  value={formObservacoes}
                  onChange={e => setFormObservacoes(e.target.value)}
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Salvando...' : editingFolga ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
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
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Folgas Cadastradas ({folgas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : folgas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma folga encontrada no período</p>
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
                {folgas.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.colaborador_nome}</TableCell>
                    <TableCell>{formatLocalDate(f.data_folga)}</TableCell>
                    <TableCell>
                      {f.motivo ? (
                        <Badge variant="secondary">{f.motivo}</Badge>
                      ) : '-'}
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
  );
}
