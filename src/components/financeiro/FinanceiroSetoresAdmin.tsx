import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Loader2, Building } from 'lucide-react';
import { toast } from 'sonner';

interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export function FinanceiroSetoresAdmin() {
  const [loading, setLoading] = useState(true);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fin_setores')
        .select('*')
        .order('nome');

      setSetores(data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openDialog = (setor?: Setor) => {
    if (setor) {
      setEditingSetor(setor);
      setFormNome(setor.nome);
      setFormDescricao(setor.descricao || '');
    } else {
      setEditingSetor(null);
      setFormNome('');
      setFormDescricao('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null
      };

      if (editingSetor) {
        const { error } = await supabase
          .from('fin_setores')
          .update(data)
          .eq('id', editingSetor.id);

        if (error) throw error;
        toast.success('Setor atualizado');
      } else {
        const { error } = await supabase
          .from('fin_setores')
          .insert(data);

        if (error) throw error;
        toast.success('Setor criado');
      }

      setShowDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar setor:', error);
      toast.error('Erro ao salvar setor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja inativar este setor?')) return;

    try {
      const { error } = await supabase
        .from('fin_setores')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Setor inativado');
      fetchData();
    } catch (error) {
      console.error('Erro ao inativar setor:', error);
      toast.error('Erro ao inativar setor');
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('fin_setores')
        .update({ ativo: !ativo })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Setor ${ativo ? 'inativado' : 'ativado'}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Setores</CardTitle>
            <CardDescription>Gerencie os setores para categorização de despesas do escritório</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Setor
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : setores.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum setor cadastrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setores.map((setor) => (
                <TableRow key={setor.id} className={!setor.ativo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{setor.nome}</TableCell>
                  <TableCell>{setor.descricao || '-'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={setor.ativo ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleAtivo(setor.id, setor.ativo)}
                    >
                      {setor.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(setor)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(setor.id)}>
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSetor ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
