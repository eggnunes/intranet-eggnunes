import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Star, Edit, Eye, Ban, CheckCircle, Phone, Building2, Trash2, MessageSquare } from 'lucide-react';
import { ParceiroDialog } from './ParceiroDialog';
import { ParceiroDetalhes } from './ParceiroDetalhes';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useUserRole } from '@/hooks/useUserRole';

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

interface AreaAtuacao {
  id: string;
  nome: string;
}

export function ParceirosList() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('ativos');
  const [filtroArea, setFiltroArea] = useState('todas');
  const [areasDisponiveis, setAreasDisponiveis] = useState<AreaAtuacao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selectedParceiro, setSelectedParceiro] = useState<Parceiro | null>(null);
  const [observacaoDialogOpen, setObservacaoDialogOpen] = useState(false);
  const [observacaoParceiro, setObservacaoParceiro] = useState<Parceiro | null>(null);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [savingObservacao, setSavingObservacao] = useState(false);

  const { canEdit, isSocioOrRafael } = useAdminPermissions();
  const { isAdmin, profile } = useUserRole();

  // Verificar permissões:
  // - Qualquer usuário pode cadastrar (sempre true)
  // - Inativar: somente comercial e admins
  // - Excluir: somente admins
  const podeInativar = isSocioOrRafael || isAdmin || profile?.position === 'comercial' || canEdit('parceiros');
  const podeExcluir = isSocioOrRafael || isAdmin;

  const fetchAreas = async () => {
    const { data } = await supabase
      .from('parceiros_areas_atuacao')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (data) setAreasDisponiveis(data);
  };

  const fetchParceiros = async () => {
    setLoading(true);
    try {
      // Se filtro por área está ativo, precisamos buscar de forma diferente
      if (filtroArea !== 'todas') {
        // Primeiro buscar os IDs de parceiros que têm essa área
        const { data: parceiroIds } = await supabase
          .from('parceiros_areas')
          .select('parceiro_id')
          .eq('area_id', filtroArea);
        
        const ids = parceiroIds?.map(p => p.parceiro_id) || [];
        
        if (ids.length === 0) {
          setParceiros([]);
          setLoading(false);
          return;
        }

        let query = supabase
          .from('parceiros')
          .select(`
            *,
            parceiros_areas(
              area:parceiros_areas_atuacao(id, nome)
            )
          `)
          .in('id', ids)
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
      } else {
        let query = supabase
          .from('parceiros')
          .select(`
            *,
            parceiros_areas(
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
      }
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
    fetchAreas();
  }, []);

  useEffect(() => {
    fetchParceiros();
  }, [filtroTipo, filtroStatus, filtroArea]);

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
    if (!podeInativar) {
      toast.error('Você não tem permissão para inativar parceiros');
      return;
    }

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

  const handleDelete = async (parceiro: Parceiro) => {
    if (!podeExcluir) {
      toast.error('Você não tem permissão para excluir parceiros');
      return;
    }

    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o parceiro "${parceiro.nome_completo}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const { error } = await supabase
        .from('parceiros')
        .delete()
        .eq('id', parceiro.id);

      if (error) throw error;
      toast.success('Parceiro excluído com sucesso!');
      fetchParceiros();
    } catch (error) {
      console.error('Erro ao excluir parceiro:', error);
      toast.error('Erro ao excluir parceiro. Verifique se não há indicações ou pagamentos vinculados.');
    }
  };

  const handleOpenObservacao = (parceiro: Parceiro) => {
    setObservacaoParceiro(parceiro);
    setNovaObservacao(parceiro.observacoes || '');
    setObservacaoDialogOpen(true);
  };

  const handleSaveObservacao = async () => {
    if (!observacaoParceiro) return;
    
    setSavingObservacao(true);
    try {
      const { error } = await supabase
        .from('parceiros')
        .update({ observacoes: novaObservacao || null })
        .eq('id', observacaoParceiro.id);

      if (error) throw error;
      toast.success('Observação salva com sucesso!');
      setObservacaoDialogOpen(false);
      fetchParceiros();
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast.error('Erro ao salvar observação');
    } finally {
      setSavingObservacao(false);
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
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Área de Atuação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Áreas</SelectItem>
                {areasDisponiveis.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.nome}
                  </SelectItem>
                ))}
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
                  <TableHead className="w-[180px]">Ações</TableHead>
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
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {parceiro.nome_completo}
                          {parceiro.observacoes && (
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
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
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(parceiro)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(parceiro)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenObservacao(parceiro)} title="Observação">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          {podeInativar && (
                            <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(parceiro)} title={parceiro.ativo ? 'Inativar' : 'Reativar'}>
                              {parceiro.ativo ? (
                                <Ban className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(parceiro)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {/* Dialog para Observação */}
      <Dialog open={observacaoDialogOpen} onOpenChange={setObservacaoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observação - {observacaoParceiro?.nome_completo}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Digite uma observação sobre este parceiro..."
              value={novaObservacao}
              onChange={(e) => setNovaObservacao(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservacaoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveObservacao} disabled={savingObservacao}>
              {savingObservacao ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}