import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, ExternalLink, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface TribunalLink {
  id: string;
  nome: string;
  url: string;
  tribunal: string;
  sistema: string;
  categoria: string;
  ordem: number;
  ativo: boolean;
}

interface FormData {
  nome: string;
  url: string;
  tribunal: string;
  sistema: string;
  categoria: string;
  ordem: number;
}

const initialFormData: FormData = {
  nome: '',
  url: '',
  tribunal: '',
  sistema: 'PJE',
  categoria: 'estadual',
  ordem: 0,
};

export const TribunalLinksAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<TribunalLink | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['tribunal-links-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tribunal_links')
        .select('*')
        .order('ordem', { ascending: true });
      
      if (error) throw error;
      return data as TribunalLink[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase
        .from('tribunal_links')
        .insert({
          ...data,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tribunal-links-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tribunal-links'] });
      toast({ title: 'Link criado com sucesso!' });
      setIsDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: () => {
      toast({ title: 'Erro ao criar link', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TribunalLink> }) => {
      const { error } = await supabase
        .from('tribunal_links')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tribunal-links-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tribunal-links'] });
      toast({ title: 'Link atualizado com sucesso!' });
      setIsDialogOpen(false);
      setEditingLink(null);
      setFormData(initialFormData);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar link', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tribunal_links')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tribunal-links-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tribunal-links'] });
      toast({ title: 'Link excluído com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir link', variant: 'destructive' });
    },
  });

  const handleEdit = (link: TribunalLink) => {
    setEditingLink(link);
    setFormData({
      nome: link.nome,
      url: link.url,
      tribunal: link.tribunal,
      sistema: link.sistema,
      categoria: link.categoria,
      ordem: link.ordem,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleAtivo = (link: TribunalLink) => {
    updateMutation.mutate({ id: link.id, data: { ativo: !link.ativo } });
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingLink(null);
    setFormData(initialFormData);
  };

  const filteredLinks = links.filter(link =>
    link.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.tribunal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.sistema.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Links de Tribunais</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) handleDialogClose();
          else setIsDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingLink(null); setFormData(initialFormData); }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingLink ? 'Editar Link' : 'Novo Link de Tribunal'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Card</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: PJE TJMG 1º Grau"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL do Portal</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tribunal">Tribunal</Label>
                  <Input
                    id="tribunal"
                    value={formData.tribunal}
                    onChange={(e) => setFormData({ ...formData, tribunal: e.target.value })}
                    placeholder="Ex: TJMG"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sistema">Sistema</Label>
                  <Select
                    value={formData.sistema}
                    onValueChange={(value) => setFormData({ ...formData, sistema: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PJE">PJE</SelectItem>
                      <SelectItem value="E-Proc">E-Proc</SelectItem>
                      <SelectItem value="ESAJ">ESAJ</SelectItem>
                      <SelectItem value="RUPE">RUPE</SelectItem>
                      <SelectItem value="Tarefas">Tarefas</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="federal">Federal</SelectItem>
                      <SelectItem value="militar">Militar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingLink ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar links..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Sistema</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLinks.map((link) => (
                <TableRow key={link.id} className={!link.ativo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {link.nome}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>{link.tribunal}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{link.sistema}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {link.categoria === 'federal' ? 'Federal' : 
                       link.categoria === 'estadual' ? 'Estadual' : 
                       link.categoria === 'militar' ? 'Militar' : link.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={link.ativo}
                      onCheckedChange={() => handleToggleAtivo(link)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(link)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir link?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o link "{link.nome}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(link.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLinks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum link encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
