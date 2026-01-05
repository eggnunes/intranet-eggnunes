import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Star, Edit, Eye, Ban, CheckCircle, Phone, Building2 } from 'lucide-react';
import { ParceiroDialog } from './ParceiroDialog';
import { ParceiroDetalhes } from './ParceiroDetalhes';

interface Parceiro {
  id: string;
  nome_completo: string;
  nome_escritorio: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ranking: number;
  tipo: string;
  ativo: boolean;
  data_cadastro: string;
  areas: { id: string; nome: string }[];
}

export function ParceirosList() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('ativos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selectedParceiro, setSelectedParceiro] = useState<Parceiro | null>(null);

  const fetchParceiros = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('parceiros')
        .select(`
          *,
          parceiros_areas!inner(
            area:parceiros_areas_atuacao(id, nome)
          )
        `)
        .order('ranking', { ascending: false });

      if (filtroStatus === 'ativos') {
        query = query.eq('ativo', true);
      } else if (filtroStatus === 'inativos') {
        query = query.eq('ativo', false);
      }

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo);
      }

      const { data, error } = await query;

      if (error) throw error;

      const parceirosFormatados = (data || []).map((p: any) => ({
        ...p,
        areas: p.parceiros_areas?.map((pa: any) => pa.area).filter(Boolean) || []
      }));

      setParceiros(parceirosFormatados);
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
      // Se erro for de relacionamento, buscar sem as áreas
      try {
        let query = supabase
          .from('parceiros')
          .select('*')
          .order('ranking', { ascending: false });

        if (filtroStatus === 'ativos') {
          query = query.eq('ativo', true);
        } else if (filtroStatus === 'inativos') {
          query = query.eq('ativo', false);
        }

        if (filtroTipo !== 'todos') {
          query = query.eq('tipo', filtroTipo);
        }

        const { data, error } = await query;
        if (error) throw error;
        setParceiros((data || []).map(p => ({ ...p, areas: [] })));
      } catch (e) {
        toast.error('Erro ao carregar parceiros');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParceiros();
  }, [filtroTipo, filtroStatus]);

  const filteredParceiros = parceiros.filter(p =>
    p.nome_completo.toLowerCase().includes(busca.toLowerCase()) ||
    p.nome_escritorio?.toLowerCase().includes(busca.toLowerCase()) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleEdit = (parceiro: Parceiro) => {
    setEditingParceiro(parceiro);
    setDialogOpen(true);
  };

  const handleViewDetails = (parceiro: Parceiro) => {
    setSelectedParceiro(parceiro);
    setDetalhesOpen(true);
  };

  const handleToggleStatus = async (parceiro: Parceiro) => {
    const action = parceiro.ativo ? 'inativar' : 'reativar';
    if (!confirm(`Tem certeza que deseja ${action} este parceiro?`)) return;

    try {
      const { error } = await supabase
        .from('parceiros')
        .update({
          ativo: !parceiro.ativo,
          data_inativacao: !parceiro.ativo ? null : new Date().toISOString(),
          motivo_inativacao: !parceiro.ativo ? null : 'Inativado pelo usuário'
        })
        .eq('id', parceiro.id);

      if (error) throw error;
      toast.success(`Parceiro ${action === 'inativar' ? 'inativado' : 'reativado'} com sucesso!`);
      fetchParceiros();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do parceiro');
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'indicamos':
        return <Badge className="bg-blue-500">Indicamos</Badge>;
      case 'nos_indicam':
        return <Badge className="bg-purple-500">Nos Indicam</Badge>;
      case 'ambos':
        return <Badge className="bg-green-500">Ambos</Badge>;
      default:
        return <Badge>{tipo}</Badge>;
    }
  };

  const renderStars = (ranking: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= ranking ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Parceiros</CardTitle>
              <CardDescription>Gerencie seus parceiros de indicação</CardDescription>
            </div>
            <Button onClick={() => { setEditingParceiro(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Parceiro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, escritório ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="indicamos">Indicamos</SelectItem>
                <SelectItem value="nos_indicam">Nos Indicam</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ranking</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Áreas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredParceiros.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum parceiro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParceiros.map((parceiro) => (
                    <TableRow key={parceiro.id} className={!parceiro.ativo ? 'opacity-60' : ''}>
                      <TableCell>{renderStars(parceiro.ranking)}</TableCell>
                      <TableCell className="font-medium">{parceiro.nome_completo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {parceiro.nome_escritorio || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{getTipoBadge(parceiro.tipo)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {parceiro.telefone || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parceiro.areas.slice(0, 2).map((area) => (
                            <Badge key={area.id} variant="outline" className="text-xs">
                              {area.nome}
                            </Badge>
                          ))}
                          {parceiro.areas.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{parceiro.areas.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={parceiro.ativo ? 'default' : 'secondary'}>
                          {parceiro.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(parceiro)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(parceiro)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(parceiro)}>
                            {parceiro.ativo ? (
                              <Ban className="h-4 w-4 text-destructive" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ParceiroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        parceiro={editingParceiro}
        onSuccess={fetchParceiros}
      />

      <ParceiroDetalhes
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        parceiro={selectedParceiro}
        onRefresh={fetchParceiros}
      />
    </>
  );
}
