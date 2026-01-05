import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
  descricao: string | null;
  is_active: boolean;
}

export function RHCargos() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [formData, setFormData] = useState({ nome: '', valor_base: '', descricao: '' });

  useEffect(() => {
    fetchCargos();
  }, []);

  const fetchCargos = async () => {
    try {
      const { data, error } = await supabase
        .from('rh_cargos')
        .select('*')
        .order('valor_base', { ascending: true });

      if (error) throw error;
      setCargos(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar cargos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const valor = parseFloat(formData.valor_base.replace(/[^\d,.-]/g, '').replace(',', '.'));
      
      if (editingCargo) {
        const { error } = await supabase
          .from('rh_cargos')
          .update({
            nome: formData.nome,
            valor_base: valor,
            descricao: formData.descricao || null
          })
          .eq('id', editingCargo.id);

        if (error) throw error;
        toast.success('Cargo atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('rh_cargos')
          .insert({
            nome: formData.nome,
            valor_base: valor,
            descricao: formData.descricao || null
          });

        if (error) throw error;
        toast.success('Cargo criado com sucesso!');
      }

      setDialogOpen(false);
      setEditingCargo(null);
      setFormData({ nome: '', valor_base: '', descricao: '' });
      fetchCargos();
    } catch (error: any) {
      toast.error('Erro ao salvar cargo: ' + error.message);
    }
  };

  const handleEdit = (cargo: Cargo) => {
    setEditingCargo(cargo);
    setFormData({
      nome: cargo.nome,
      valor_base: cargo.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      descricao: cargo.descricao || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (cargo: Cargo) => {
    if (!confirm(`Tem certeza que deseja excluir o cargo "${cargo.nome}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('rh_cargos')
        .delete()
        .eq('id', cargo.id);

      if (error) throw error;
      toast.success('Cargo excluído com sucesso!');
      fetchCargos();
    } catch (error: any) {
      toast.error('Erro ao excluir cargo: ' + error.message);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Cargos e Salários
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCargo(null);
            setFormData({ nome: '', valor_base: '', descricao: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cargo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCargo ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Cargo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_base">Valor Base (R$)</Label>
                <Input
                  id="valor_base"
                  value={formData.valor_base}
                  onChange={(e) => setFormData({ ...formData, valor_base: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCargo ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Valor Base</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargos.map((cargo) => (
              <TableRow key={cargo.id}>
                <TableCell className="font-medium">{cargo.nome}</TableCell>
                <TableCell>{formatCurrency(cargo.valor_base)}</TableCell>
                <TableCell className="text-muted-foreground">{cargo.descricao || '-'}</TableCell>
                <TableCell>
                  <Badge variant={cargo.is_active ? 'default' : 'secondary'}>
                    {cargo.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cargo)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cargo)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {cargos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cargo cadastrado
          </div>
        )}
      </CardContent>
    </Card>
  );
}
