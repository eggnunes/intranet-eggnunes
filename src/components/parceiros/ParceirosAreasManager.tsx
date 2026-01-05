import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AreaAtuacao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export function ParceirosAreasManager() {
  const { user } = useAuth();
  const [areas, setAreas] = useState<AreaAtuacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaAtuacao | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '', ativo: true });

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parceiros_areas_atuacao')
        .select('*')
        .order('nome');

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
      toast.error('Erro ao carregar áreas de atuação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const handleOpenDialog = (area?: AreaAtuacao) => {
    if (area) {
      setEditingArea(area);
      setFormData({ nome: area.nome, descricao: area.descricao || '', ativo: area.ativo });
    } else {
      setEditingArea(null);
      setFormData({ nome: '', descricao: '', ativo: true });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingArea) {
        const { error } = await supabase
          .from('parceiros_areas_atuacao')
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            ativo: formData.ativo
          })
          .eq('id', editingArea.id);

        if (error) throw error;
        toast.success('Área atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('parceiros_areas_atuacao')
          .insert({
            nome: formData.nome,
            descricao: formData.descricao || null,
            ativo: formData.ativo,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success('Área criada com sucesso!');
      }

      setDialogOpen(false);
      fetchAreas();
    } catch (error: any) {
      console.error('Erro ao salvar área:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma área com este nome');
      } else {
        toast.error('Erro ao salvar área');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta área?')) return;

    try {
      const { error } = await supabase
        .from('parceiros_areas_atuacao')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Área excluída com sucesso!');
      fetchAreas();
    } catch (error) {
      console.error('Erro ao excluir área:', error);
      toast.error('Erro ao excluir área');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Áreas de Atuação</CardTitle>
              <CardDescription>Gerencie as áreas de atuação dos parceiros</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Área
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : areas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma área cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.nome}</TableCell>
                    <TableCell>{area.descricao || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${area.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {area.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(area)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(area.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? 'Editar Área' : 'Nova Área de Atuação'}</DialogTitle>
            <DialogDescription>
              {editingArea ? 'Atualize os dados da área' : 'Cadastre uma nova área de atuação para parceiros'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Trabalhista"
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Direito do Trabalho"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
