import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Award, Plus, Search, MoreVertical, Trash2, Eye, TrendingUp, Calendar, User, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PromocaoDialog, type PromocaoParaEditar } from './PromocaoDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Promocao {
  id: string;
  colaborador_id: string;
  cargo_anterior_nome: string;
  cargo_novo_nome: string;
  cargo_anterior_id: string | null;
  cargo_novo_id: string | null;
  data_promocao: string;
  observacoes: string | null;
  created_at: string;
  colaborador?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string;
    join_date: string | null;
  };
}

export function RHPromocoes() {
  const navigate = useNavigate();
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promocaoToDelete, setPromocaoToDelete] = useState<Promocao | null>(null);
  const [promocaoParaEditar, setPromocaoParaEditar] = useState<PromocaoParaEditar | null>(null);

  useEffect(() => {
    fetchPromocoes();
  }, []);

  const fetchPromocoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rh_promocoes')
        .select(`
          id,
          colaborador_id,
          cargo_anterior_nome,
          cargo_novo_nome,
          cargo_anterior_id,
          cargo_novo_id,
          data_promocao,
          observacoes,
          created_at
        `)
        .order('data_promocao', { ascending: false });

      if (error) throw error;

      // Buscar dados dos colaboradores incluindo data de ingresso
      const colaboradorIds = [...new Set((data || []).map(p => p.colaborador_id))];
      const { data: colabData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position, join_date')
        .in('id', colaboradorIds);

      const colabMap = new Map((colabData || []).map(c => [c.id, c]));

      const promocoesComColab = (data || []).map(p => ({
        ...p,
        colaborador: colabMap.get(p.colaborador_id)
      }));

      setPromocoes(promocoesComColab as Promocao[]);
    } catch (error: any) {
      toast.error('Erro ao carregar promoções: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!promocaoToDelete) return;

    try {
      const { error } = await supabase
        .from('rh_promocoes')
        .delete()
        .eq('id', promocaoToDelete.id);

      if (error) throw error;

      toast.success('Promoção removida com sucesso');
      setDeleteDialogOpen(false);
      setPromocaoToDelete(null);
      fetchPromocoes();
    } catch (error: any) {
      toast.error('Erro ao remover promoção: ' + error.message);
    }
  };

  const handleEdit = (promocao: Promocao) => {
    setPromocaoParaEditar({
      id: promocao.id,
      colaborador_id: promocao.colaborador_id,
      cargo_anterior_id: promocao.cargo_anterior_id,
      cargo_novo_id: promocao.cargo_novo_id,
      data_promocao: promocao.data_promocao,
      observacoes: promocao.observacoes,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPromocaoParaEditar(null);
    }
  };

  const filteredPromocoes = promocoes.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      p.colaborador?.full_name?.toLowerCase().includes(search) ||
      p.cargo_anterior_nome.toLowerCase().includes(search) ||
      p.cargo_novo_nome.toLowerCase().includes(search)
    );
  });

  // Estatísticas
  const thisYear = new Date().getFullYear();
  const promocoesEsteAno = promocoes.filter(p => {
    const year = parseInt(p.data_promocao.substring(0, 4));
    return year === thisYear;
  }).length;

  const colaboradoresPromovidos = new Set(promocoes.map(p => p.colaborador_id)).size;

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Promoções</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promocoes.length}</div>
            <p className="text-xs text-muted-foreground">Registradas no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promoções em {thisYear}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promocoesEsteAno}</div>
            <p className="text-xs text-muted-foreground">Este ano</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores Promovidos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{colaboradoresPromovidos}</div>
            <p className="text-xs text-muted-foreground">Com pelo menos 1 promoção</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Promoções */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Histórico de Promoções
              </CardTitle>
              <CardDescription>
                Gerencie e registre promoções de colaboradores
              </CardDescription>
            </div>
            <Button onClick={() => { setPromocaoParaEditar(null); setDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Promoção
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Busca */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabela */}
          {filteredPromocoes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data de Ingresso</TableHead>
                  <TableHead>Cargo Anterior</TableHead>
                  <TableHead>Novo Cargo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromocoes.map((promocao) => (
                  <TableRow key={promocao.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={promocao.colaborador?.avatar_url || undefined} />
                          <AvatarFallback>
                            {promocao.colaborador?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{promocao.colaborador?.full_name || 'Colaborador'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {promocao.colaborador?.join_date
                        ? format(parse(promocao.colaborador.join_date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{promocao.cargo_anterior_nome}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">{promocao.cargo_novo_nome}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(parse(promocao.data_promocao, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {promocao.observacoes || '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/rh?colaboradorId=${promocao.colaborador_id}&tab=carreira`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(promocao)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setPromocaoToDelete(promocao);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma promoção encontrada</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                Registrar Primeira Promoção
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para nova/editar promoção */}
      <PromocaoDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        promocaoParaEditar={promocaoParaEditar}
        onSuccess={fetchPromocoes}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Promoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta promoção de {promocaoToDelete?.colaborador?.full_name}?
              Esta ação não pode ser desfeita e não irá reverter o cargo atual do colaborador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
