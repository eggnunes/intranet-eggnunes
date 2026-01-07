import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, FileText, DollarSign, Calendar, Users, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
  position: string;
  cargo_id: string | null;
  rh_cargos?: { nome: string; valor_base: number } | null;
}

interface Rubrica {
  id: string;
  nome: string;
  tipo: 'vantagem' | 'desconto';
  ordem: number;
}

interface PagamentoItem {
  rubrica_id: string;
  valor: number;
  observacao: string;
}

interface Pagamento {
  id: string;
  colaborador_id: string;
  mes_referencia: string;
  status: string;
  total_vantagens: number;
  total_descontos: number;
  total_liquido: number;
  data_pagamento: string | null;
  recibo_gerado: boolean;
  profiles: { full_name: string; email: string };
}

export function RHPagamentos() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(format(new Date(), 'yyyy-MM'));
  const [filtroMes, setFiltroMes] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itens, setItens] = useState<Record<string, PagamentoItem>>({});
  const [sugestoes, setSugestoes] = useState<Record<string, number>>({});
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPagamentos();
  }, [filtroMes]);

  const fetchData = async () => {
    try {
      const [colabRes, rubRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, position, cargo_id')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('rh_rubricas')
          .select('*')
          .eq('is_active', true)
          .order('ordem')
      ]);

      if (colabRes.error) throw colabRes.error;
      if (rubRes.error) throw rubRes.error;

      setColaboradores((colabRes.data || []).map(c => ({ ...c, rh_cargos: null })) as Colaborador[]);
      setRubricas((rubRes.data || []).map(r => ({ ...r, tipo: r.tipo as 'vantagem' | 'desconto' })));
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPagamentos = async () => {
    try {
      const startDate = startOfMonth(new Date(filtroMes + '-01'));
      const endDate = endOfMonth(startDate);

      const { data: pagData, error } = await supabase
        .from('rh_pagamentos')
        .select('*')
        .gte('mes_referencia', format(startDate, 'yyyy-MM-dd'))
        .lte('mes_referencia', format(endDate, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const colaboradorIds = [...new Set((pagData || []).map(p => p.colaborador_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', colaboradorIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      const pagamentosWithProfiles = (pagData || []).map(p => ({
        ...p,
        profiles: profilesMap.get(p.colaborador_id) || { full_name: 'Desconhecido', email: '' }
      }));

      setPagamentos(pagamentosWithProfiles as Pagamento[]);
    } catch (error: any) {
      toast.error('Erro ao carregar pagamentos: ' + error.message);
    }
  };

  const loadSugestoes = async (colaboradorId: string) => {
    try {
      const { data, error } = await supabase
        .from('rh_sugestoes_valores')
        .select('rubrica_id, valor_sugerido')
        .eq('colaborador_id', colaboradorId);

      if (error) throw error;

      const sugestoesMap: Record<string, number> = {};
      data?.forEach(s => {
        sugestoesMap[s.rubrica_id] = s.valor_sugerido;
      });
      setSugestoes(sugestoesMap);

      // Pré-preencher com sugestões
      const newItens: Record<string, PagamentoItem> = {};
      rubricas.forEach(r => {
        newItens[r.id] = {
          rubrica_id: r.id,
          valor: sugestoesMap[r.id] || 0,
          observacao: ''
        };
      });
      setItens(newItens);
    } catch (error: any) {
      console.error('Erro ao carregar sugestões:', error);
    }
  };

  const handleColaboradorChange = (colaboradorId: string) => {
    setSelectedColaborador(colaboradorId);
    loadSugestoes(colaboradorId);
  };

  const handleItemChange = (rubricaId: string, field: 'valor' | 'observacao', value: string) => {
    setItens(prev => ({
      ...prev,
      [rubricaId]: {
        ...prev[rubricaId],
        rubrica_id: rubricaId,
        [field]: field === 'valor' ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0 : value
      }
    }));
  };

  const calcularTotais = () => {
    let vantagens = 0;
    let descontos = 0;

    Object.entries(itens).forEach(([rubricaId, item]) => {
      const rubrica = rubricas.find(r => r.id === rubricaId);
      if (rubrica && item.valor > 0) {
        if (rubrica.tipo === 'vantagem') {
          vantagens += item.valor;
        } else {
          descontos += item.valor;
        }
      }
    });

    return { vantagens, descontos, liquido: vantagens - descontos };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaborador) {
      toast.error('Selecione um colaborador');
      return;
    }

    const totais = calcularTotais();

    try {
      const { data: user } = await supabase.auth.getUser();

      // Criar pagamento
      const { data: pagamento, error: pagError } = await supabase
        .from('rh_pagamentos')
        .insert({
          colaborador_id: selectedColaborador,
          mes_referencia: mesReferencia + '-01',
          data_pagamento: dataPagamento,
          total_vantagens: totais.vantagens,
          total_descontos: totais.descontos,
          total_liquido: totais.liquido,
          status: 'processado',
          created_by: user.user?.id
        })
        .select()
        .single();

      if (pagError) throw pagError;

      // Inserir itens do pagamento
      const itensToInsert = Object.entries(itens)
        .filter(([_, item]) => item.valor > 0)
        .map(([rubricaId, item]) => ({
          pagamento_id: pagamento.id,
          rubrica_id: rubricaId,
          valor: item.valor,
          observacao: item.observacao || null
        }));

      if (itensToInsert.length > 0) {
        const { error: itensError } = await supabase
          .from('rh_pagamento_itens')
          .insert(itensToInsert);

        if (itensError) throw itensError;
      }

      // Salvar sugestões para próximo mês
      const sugestoesToUpsert = Object.entries(itens)
        .filter(([_, item]) => item.valor > 0)
        .map(([rubricaId, item]) => ({
          colaborador_id: selectedColaborador,
          rubrica_id: rubricaId,
          valor_sugerido: item.valor
        }));

      if (sugestoesToUpsert.length > 0) {
        for (const sug of sugestoesToUpsert) {
          await supabase
            .from('rh_sugestoes_valores')
            .upsert(sug, { onConflict: 'colaborador_id,rubrica_id' });
        }
      }

      toast.success('Pagamento registrado com sucesso!');
      setDialogOpen(false);
      resetForm();
      fetchPagamentos();
    } catch (error: any) {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    }
  };

  const resetForm = () => {
    setSelectedColaborador('');
    setItens({});
    setSugestoes({});
    setMesReferencia(format(new Date(), 'yyyy-MM'));
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
  };

  const gerarRecibo = async (pagamento: Pagamento) => {
    try {
      // Buscar itens do pagamento
      const { data: itensData, error } = await supabase
        .from('rh_pagamento_itens')
        .select('*')
        .eq('pagamento_id', pagamento.id);

      if (error) throw error;

      // Buscar rubricas
      const rubricaIds = [...new Set((itensData || []).map(i => i.rubrica_id))];
      const { data: rubricasData } = await supabase
        .from('rh_rubricas')
        .select('id, nome, tipo')
        .in('id', rubricaIds);

      const rubricasMap = new Map((rubricasData || []).map(r => [r.id, r]));
      
      const itensWithRubricas = (itensData || []).map(i => ({
        ...i,
        rh_rubricas: rubricasMap.get(i.rubrica_id) || null
      }));

      const doc = new jsPDF();
      const colaborador = colaboradores.find(c => c.id === pagamento.colaborador_id);

      // Cabeçalho
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RECIBO DE PAGAMENTO', 105, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Egg Nunes Advogados Associados', 105, 30, { align: 'center' });
      doc.text('CNPJ: 10.378.694/0001-59', 105, 35, { align: 'center' });
      doc.text('Rua São Paulo, nº 1104, 9º andar, Centro, Belo Horizonte - MG', 105, 40, { align: 'center' });

      doc.line(20, 45, 190, 45);

      // Dados do colaborador
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('COLABORADOR:', 20, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(pagamento.profiles.full_name, 60, 55);

      doc.setFont('helvetica', 'bold');
      doc.text('MÊS REFERÊNCIA:', 20, 62);
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(pagamento.mes_referencia), 'MMMM/yyyy', { locale: ptBR }).toUpperCase(), 75, 62);

      doc.setFont('helvetica', 'bold');
      doc.text('DATA PAGAMENTO:', 120, 62);
      doc.setFont('helvetica', 'normal');
      doc.text(pagamento.data_pagamento ? format(new Date(pagamento.data_pagamento), 'dd/MM/yyyy') : '-', 170, 62);

      doc.line(20, 68, 190, 68);

      // Vantagens
      let y = 78;
      const vantagens = itensWithRubricas.filter(i => i.rh_rubricas?.tipo === 'vantagem');
      const descontos = itensWithRubricas.filter(i => i.rh_rubricas?.tipo === 'desconto');

      if (vantagens.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('VANTAGENS', 20, y);
        y += 8;

        doc.setFontSize(10);
        vantagens.forEach(item => {
          doc.setFont('helvetica', 'normal');
          doc.text(item.rh_rubricas?.nome || '', 25, y);
          doc.text(item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 170, y, { align: 'right' });
          y += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('Total Vantagens:', 25, y + 2);
        doc.text(pagamento.total_vantagens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 170, y + 2, { align: 'right' });
        y += 12;
      }

      if (descontos.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DESCONTOS', 20, y);
        y += 8;

        doc.setFontSize(10);
        descontos.forEach(item => {
          doc.setFont('helvetica', 'normal');
          doc.text(item.rh_rubricas?.nome || '', 25, y);
          doc.text('(-) ' + item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 170, y, { align: 'right' });
          y += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('Total Descontos:', 25, y + 2);
        doc.text('(-) ' + pagamento.total_descontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 170, y + 2, { align: 'right' });
        y += 12;
      }

      // Total líquido
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('VALOR LÍQUIDO:', 20, y);
      doc.text(pagamento.total_liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 170, y, { align: 'right' });

      // Assinatura
      y += 30;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Declaro ter recebido os valores acima discriminados.', 105, y, { align: 'center' });

      y += 25;
      doc.line(50, y, 160, y);
      y += 5;
      doc.text(pagamento.profiles.full_name, 105, y, { align: 'center' });

      y += 15;
      doc.text(`Belo Horizonte, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 105, y, { align: 'center' });

      doc.save(`recibo_${pagamento.profiles.full_name.replace(/\s+/g, '_')}_${format(new Date(pagamento.mes_referencia), 'MM_yyyy')}.pdf`);

      // Marcar recibo como gerado
      await supabase
        .from('rh_pagamentos')
        .update({ recibo_gerado: true })
        .eq('id', pagamento.id);

      toast.success('Recibo gerado com sucesso!');
      fetchPagamentos();
    } catch (error: any) {
      toast.error('Erro ao gerar recibo: ' + error.message);
    }
  };

  const gerarRecibosEmLote = async () => {
    if (selectedForBatch.length === 0) {
      toast.error('Selecione pelo menos um pagamento');
      return;
    }

    for (const pagId of selectedForBatch) {
      const pag = pagamentos.find(p => p.id === pagId);
      if (pag) {
        await gerarRecibo(pag);
      }
    }

    setSelectedForBatch([]);
    toast.success(`${selectedForBatch.length} recibos gerados!`);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totais = calcularTotais();

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros e Ações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamentos de Colaboradores
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-40"
            />
            {selectedForBatch.length > 0 && (
              <Button onClick={gerarRecibosEmLote} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Gerar {selectedForBatch.length} Recibos
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Registrar Pagamento</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                  <form onSubmit={handleSubmit} className="space-y-4 pb-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Colaborador</Label>
                        <Select value={selectedColaborador} onValueChange={handleColaboradorChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {colaboradores.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Mês Referência</Label>
                        <Input
                          type="month"
                          value={mesReferencia}
                          onChange={(e) => setMesReferencia(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Pagamento</Label>
                        <Input
                          type="date"
                          value={dataPagamento}
                          onChange={(e) => setDataPagamento(e.target.value)}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Vantagens */}
                    <div>
                      <h4 className="font-semibold text-green-600 mb-3">Vantagens</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {rubricas.filter(r => r.tipo === 'vantagem').map(rubrica => (
                          <div key={rubrica.id} className="flex items-center gap-2">
                            <Label className="w-40 text-sm truncate">{rubrica.nome}</Label>
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={itens[rubrica.id]?.valor || ''}
                              onChange={(e) => handleItemChange(rubrica.id, 'valor', e.target.value)}
                              className="w-28"
                            />
                            {sugestoes[rubrica.id] > 0 && (
                              <span className="text-xs text-muted-foreground">
                                (sugestão: {formatCurrency(sugestoes[rubrica.id])})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Descontos */}
                    <div>
                      <h4 className="font-semibold text-red-600 mb-3">Descontos</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {rubricas.filter(r => r.tipo === 'desconto').map(rubrica => (
                          <div key={rubrica.id} className="flex items-center gap-2">
                            <Label className="w-40 text-sm truncate">{rubrica.nome}</Label>
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={itens[rubrica.id]?.valor || ''}
                              onChange={(e) => handleItemChange(rubrica.id, 'valor', e.target.value)}
                              className="w-28"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Totais */}
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-sm text-muted-foreground">Total Vantagens</div>
                          <div className="text-lg font-bold text-green-600">{formatCurrency(totais.vantagens)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Descontos</div>
                          <div className="text-lg font-bold text-red-600">{formatCurrency(totais.descontos)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Valor Líquido</div>
                          <div className="text-xl font-bold">{formatCurrency(totais.liquido)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        Registrar Pagamento
                      </Button>
                    </div>
                  </form>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedForBatch.length === pagamentos.length && pagamentos.length > 0}
                    onCheckedChange={(checked) => {
                      setSelectedForBatch(checked ? pagamentos.map(p => p.id) : []);
                    }}
                  />
                </TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Vantagens</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentos.map((pag) => (
                <TableRow key={pag.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedForBatch.includes(pag.id)}
                      onCheckedChange={(checked) => {
                        setSelectedForBatch(prev => 
                          checked 
                            ? [...prev, pag.id]
                            : prev.filter(id => id !== pag.id)
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{pag.profiles.full_name}</TableCell>
                  <TableCell>
                    {format(new Date(pag.mes_referencia), 'MMM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(pag.total_vantagens)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(pag.total_descontos)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(pag.total_liquido)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pag.status === 'pago' ? 'default' : 'secondary'}>
                      {pag.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => gerarRecibo(pag)}>
                      <FileText className="h-4 w-4 mr-1" />
                      {pag.recibo_gerado ? 'Reimprimir' : 'Gerar'} Recibo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {pagamentos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pagamento encontrado para o período selecionado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
