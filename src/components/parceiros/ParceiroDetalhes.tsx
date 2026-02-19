import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Phone, Mail, Building2, Calendar, FileText, DollarSign, Plus, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IndicacaoDialog } from './IndicacaoDialog';
import { PagamentoParceiroDialog } from './PagamentoParceiroDialog';
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

interface Indicacao {
  id: string;
  tipo_indicacao: string;
  nome_cliente: string;
  descricao_caso: string | null;
  percentual_comissao: number;
  valor_total_causa: number | null;
  valor_comissao: number | null;
  status: string;
  data_indicacao: string;
  area: { nome: string } | null;
}

interface Pagamento {
  id: string;
  tipo: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  parcela_atual: number;
  total_parcelas: number;
}

interface ParceiroDetalhesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiro: Parceiro | null;
  onRefresh: () => void;
}

export function ParceiroDetalhes({ open, onOpenChange, parceiro, onRefresh }: ParceiroDetalhesProps) {
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [indicacaoDialogOpen, setIndicacaoDialogOpen] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [selectedIndicacao, setSelectedIndicacao] = useState<Indicacao | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const { isSocioOrRafael } = useAdminPermissions();
  const { isAdmin, profile } = useUserRole();
  const podeEditarStatus = isSocioOrRafael || isAdmin || profile?.position === 'comercial';

  useEffect(() => {
    if (open && parceiro) {
      fetchData();
    }
  }, [open, parceiro]);

  const fetchData = async () => {
    if (!parceiro) return;
    setLoading(true);
    try {
      // Buscar indicações
      const { data: indicacoesData, error: indicacoesError } = await supabase
        .from('parceiros_indicacoes')
        .select(`
          *,
          area:parceiros_areas_atuacao(nome)
        `)
        .eq('parceiro_id', parceiro.id)
        .order('data_indicacao', { ascending: false });

      if (indicacoesError) throw indicacoesError;
      setIndicacoes(indicacoesData || []);

      // Buscar pagamentos
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from('parceiros_pagamentos')
        .select('*')
        .eq('parceiro_id', parceiro.id)
        .order('data_vencimento', { ascending: false });

      if (pagamentosError) throw pagamentosError;
      setPagamentos(pagamentosData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar detalhes do parceiro');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (indicacaoId: string, newStatus: string) => {
    setSavingStatus(true);
    try {
      const { error } = await supabase
        .from('parceiros_indicacoes')
        .update({ status: newStatus })
        .eq('id', indicacaoId);

      if (error) throw error;
      toast.success('Status atualizado com sucesso!');
      setEditingStatusId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setSavingStatus(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const renderStars = (ranking: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= ranking ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );

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

  if (!parceiro) return null;

  // Estatísticas
  const totalIndicacoesEnviadas = indicacoes.filter(i => i.tipo_indicacao === 'enviada').length;
  const totalIndicacoesRecebidas = indicacoes.filter(i => i.tipo_indicacao === 'recebida').length;
  const valorTotalReceber = pagamentos.filter(p => p.tipo === 'receber' && p.status !== 'pago').reduce((acc, p) => acc + p.valor, 0);
  const valorTotalPagar = pagamentos.filter(p => p.tipo === 'pagar' && p.status !== 'pago').reduce((acc, p) => acc + p.valor, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <span>{parceiro.nome_completo}</span>
              {renderStars(parceiro.ranking)}
              {getTipoBadge(parceiro.tipo)}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {/* Informações do Parceiro */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {parceiro.nome_escritorio && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.nome_escritorio}</span>
                </div>
              )}
              {parceiro.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.telefone}</span>
                </div>
              )}
              {parceiro.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{parceiro.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Desde {format(new Date(parceiro.data_cadastro), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{totalIndicacoesEnviadas}</div>
                  <p className="text-sm text-muted-foreground">Causas Enviadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">{totalIndicacoesRecebidas}</div>
                  <p className="text-sm text-muted-foreground">Causas Recebidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(valorTotalReceber)}</div>
                  <p className="text-sm text-muted-foreground">A Receber</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(valorTotalPagar)}</div>
                  <p className="text-sm text-muted-foreground">A Pagar</p>
                </CardContent>
              </Card>
            </div>

            {parceiro.observacoes && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{parceiro.observacoes}</p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="indicacoes">
              <TabsList>
                <TabsTrigger value="indicacoes">
                  <FileText className="h-4 w-4 mr-2" />
                  Indicações
                </TabsTrigger>
                <TabsTrigger value="pagamentos">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pagamentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="indicacoes" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={() => { setSelectedIndicacao(null); setIndicacaoDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Indicação
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indicacoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma indicação registrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      indicacoes.map((ind) => (
                        <TableRow key={ind.id}>
                          <TableCell>
                            <Badge variant={ind.tipo_indicacao === 'enviada' ? 'default' : 'secondary'}>
                              {ind.tipo_indicacao === 'enviada' ? 'Enviada' : 'Recebida'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{ind.nome_cliente}</TableCell>
                          <TableCell>{ind.area?.nome || '-'}</TableCell>
                          <TableCell>{ind.percentual_comissao}%</TableCell>
                          <TableCell>{formatCurrency(ind.valor_comissao)}</TableCell>
                          <TableCell>
                            {podeEditarStatus && editingStatusId === ind.id ? (
                              <Select
                                value={ind.status}
                                onValueChange={(v) => handleStatusChange(ind.id, v)}
                                disabled={savingStatus}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ativa">Ativa</SelectItem>
                                  <SelectItem value="fechada">Fechada</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant={ind.status === 'ativa' ? 'outline' : ind.status === 'fechada' ? 'default' : 'destructive'}>
                                  {ind.status}
                                </Badge>
                                {podeEditarStatus && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingStatusId(ind.id)} title="Editar status">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(ind.data_indicacao), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="pagamentos" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={() => setPagamentoDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Pagamento
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum pagamento registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagamentos.map((pag) => (
                        <TableRow key={pag.id}>
                          <TableCell>
                            <Badge className={pag.tipo === 'receber' ? 'bg-green-500' : 'bg-red-500'}>
                              {pag.tipo === 'receber' ? 'A Receber' : 'A Pagar'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(pag.valor)}</TableCell>
                          <TableCell>
                            {pag.total_parcelas > 1 ? `${pag.parcela_atual}/${pag.total_parcelas}` : 'Única'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(pag.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {pag.data_pagamento 
                              ? format(new Date(pag.data_pagamento), "dd/MM/yyyy", { locale: ptBR })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={pag.status === 'pago' ? 'default' : pag.status === 'pendente' ? 'secondary' : 'destructive'}>
                              {pag.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <IndicacaoDialog
        open={indicacaoDialogOpen}
        onOpenChange={setIndicacaoDialogOpen}
        parceiroId={parceiro.id}
        parceiroTipo={parceiro.tipo}
        indicacao={selectedIndicacao}
        onSuccess={fetchData}
      />

      <PagamentoParceiroDialog
        open={pagamentoDialogOpen}
        onOpenChange={setPagamentoDialogOpen}
        parceiroId={parceiro.id}
        parceiroTipo={parceiro.tipo}
        indicacoes={indicacoes}
        onSuccess={fetchData}
      />
    </>
  );
}
