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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, DollarSign, Calendar, Users, Printer, AlertCircle, PieChart, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface Cargo {
  id: string;
  nome: string;
  valor_base: number;
  tipo: 'clt' | 'advogado' | 'socio';
}

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
  position: string;
  cargo_id: string | null;
  rh_cargos?: Cargo | null;
}

interface Rubrica {
  id: string;
  nome: string;
  tipo: 'vantagem' | 'desconto';
  ordem: number;
}

// IDs das rubricas específicas (baseado nos dados do banco)
const RUBRICA_HONORARIOS_MENSAIS = 'e6a9b3ae-1faa-4575-ac6d-50e8ddba588d';
const RUBRICA_ADIANTAMENTO = 'b22a1c45-292d-4f6a-b922-a3451c31d9d7';
const RUBRICA_IRPF = '59a6de4c-cb74-4398-8692-b7ed6c979c58';
const RUBRICA_INSS = '9d40ec99-9a94-415d-970c-65829872a52f';
const RUBRICA_VALE_TRANSPORTE = '8ff27352-aaed-4541-bdba-708de3ad6512';

// Rubricas permitidas para CLT (vantagens: Salário/Honorários, descontos: todos os 4)
const CLT_DESCONTOS = [RUBRICA_ADIANTAMENTO, RUBRICA_IRPF, RUBRICA_INSS, RUBRICA_VALE_TRANSPORTE];

// Rubricas permitidas para não-CLT (vantagens: Honorários, descontos: apenas Adiantamento)
const NAO_CLT_DESCONTOS = [RUBRICA_ADIANTAMENTO];

interface PagamentoItem {
  rubrica_id: string;
  valor: number;
  observacao: string;
}

interface RateioItem {
  id: string;
  categoriaId: string;
  percentual: number;
  valor: number;
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
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mesReferencia, setMesReferencia] = useState(format(new Date(), 'yyyy-MM'));
  const [filtroMes, setFiltroMes] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [itens, setItens] = useState<Record<string, PagamentoItem>>({});
  const [sugestoes, setSugestoes] = useState<Record<string, number>>({});
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [adiantamentosPendentes, setAdiantamentosPendentes] = useState<any[]>([]);
  const [descricaoGeral, setDescricaoGeral] = useState('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<{ id: string; nome: string }[]>([]);
  const [rateios, setRateios] = useState<RateioItem[]>([]);
  const [usarRateio, setUsarRateio] = useState(false);
  const [contaId, setContaId] = useState('');
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchPagamentos();
  }, [filtroMes]);

  const fetchData = async () => {
    try {
      const [colabRes, rubRes, cargosRes, contasRes, catRes] = await Promise.all([
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
          .order('ordem'),
        supabase
          .from('rh_cargos')
          .select('id, nome, valor_base, tipo')
          .eq('is_active', true),
        supabase
          .from('fin_contas')
          .select('id, nome')
          .eq('ativa', true),
        supabase
          .from('fin_categorias')
          .select('id, nome')
          .eq('ativa', true)
          .eq('tipo', 'despesa')
          .order('nome')
      ]);

      if (colabRes.error) throw colabRes.error;
      if (rubRes.error) throw rubRes.error;
      if (cargosRes.error) throw cargosRes.error;

      setCargos((cargosRes.data || []) as Cargo[]);
      setColaboradores((colabRes.data || []).map(c => ({ ...c, rh_cargos: null })) as Colaborador[]);
      setRubricas((rubRes.data || []).map(r => ({ ...r, tipo: r.tipo as 'vantagem' | 'desconto' })));
      setContas(contasRes.data || []);
      setCategorias(catRes.data || []);

      if (colabRes.error) throw colabRes.error;
      if (rubRes.error) throw rubRes.error;
      if (cargosRes.error) throw cargosRes.error;

      setCargos((cargosRes.data || []) as Cargo[]);
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

  const loadSugestoes = async (colaboradorId: string, cargo: Cargo | null) => {
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

      // Pré-preencher com sugestões e valor base do cargo
      const newItens: Record<string, PagamentoItem> = {};
      rubricas.forEach(r => {
        let valorInicial = sugestoesMap[r.id] || 0;
        
        // Se for a rubrica de Honorários Mensais e não tiver sugestão, usar valor_base do cargo
        if (r.id === RUBRICA_HONORARIOS_MENSAIS && !sugestoesMap[r.id] && cargo?.valor_base) {
          valorInicial = cargo.valor_base;
        }
        
        newItens[r.id] = {
          rubrica_id: r.id,
          valor: valorInicial,
          observacao: ''
        };
      });
      setItens(newItens);
    } catch (error: any) {
      console.error('Erro ao carregar sugestões:', error);
    }
  };

  const handleColaboradorChange = async (colaboradorId: string) => {
    setSelectedColaborador(colaboradorId);
    
    // Buscar cargo do colaborador
    const colaborador = colaboradores.find(c => c.id === colaboradorId);
    const cargo = colaborador?.cargo_id ? cargos.find(c => c.id === colaborador.cargo_id) || null : null;
    setSelectedCargo(cargo);
    
    loadSugestoes(colaboradorId, cargo);

    // Buscar adiantamentos pendentes
    try {
      const { data, error } = await supabase
        .from('rh_adiantamentos')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .eq('status', 'ativo')
        .gt('saldo_restante', 0);

      if (!error) {
        setAdiantamentosPendentes(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar adiantamentos:', err);
    }
  };

  // Filtrar rubricas baseado no tipo de cargo
  const getVantagensFiltradas = () => {
    // CLT: mostrar "Salário" (usamos Honorários Mensais com label diferente)
    // Não-CLT: mostrar "Honorários Mensais"
    return rubricas.filter(r => r.tipo === 'vantagem');
  };

  const getDescontosFiltrados = () => {
    if (!selectedCargo) {
      // Se não tem cargo, mostrar apenas Adiantamento
      return rubricas.filter(r => r.tipo === 'desconto' && NAO_CLT_DESCONTOS.includes(r.id));
    }
    
    if (selectedCargo.tipo === 'clt') {
      // CLT: todos os 4 descontos
      return rubricas.filter(r => r.tipo === 'desconto' && CLT_DESCONTOS.includes(r.id));
    } else {
      // Advogados/Sócios: apenas Adiantamento
      return rubricas.filter(r => r.tipo === 'desconto' && NAO_CLT_DESCONTOS.includes(r.id));
    }
  };

  // Retorna o label correto para Honorários Mensais baseado no tipo de cargo
  const getRubricaLabel = (rubrica: Rubrica) => {
    if (rubrica.id === RUBRICA_HONORARIOS_MENSAIS && selectedCargo?.tipo === 'clt') {
      return 'Salário';
    }
    return rubrica.nome;
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
    const colaborador = colaboradores.find(c => c.id === selectedColaborador);

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
          observacoes: descricaoGeral || null,
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

      // Lançar no financeiro com rateio (se configurado)
      if (totais.liquido > 0 && contaId) {
        if (usarRateio && rateios.length > 0) {
          // Criar lançamentos separados por categoria (rateio)
          for (const rateio of rateios) {
            if (rateio.valor > 0 && rateio.categoriaId) {
              const categoriaRateio = categorias.find(c => c.id === rateio.categoriaId);
              await supabase
                .from('fin_lancamentos')
                .insert({
                  tipo: 'despesa',
                  categoria_id: rateio.categoriaId,
                  conta_origem_id: contaId,
                  valor: rateio.valor,
                  descricao: `${descricaoGeral || 'Pagamento'} - ${colaborador?.full_name} (${categoriaRateio?.nome || 'Rateio'})`,
                  data_lancamento: dataPagamento,
                  origem: 'escritorio',
                  status: 'pago',
                  created_by: user.user?.id
                });
            }
          }
        } else {
          // Lançamento único (sem rateio)
          await supabase
            .from('fin_lancamentos')
            .insert({
              tipo: 'despesa',
              conta_origem_id: contaId,
              valor: totais.liquido,
              descricao: `${descricaoGeral || 'Pagamento'} - ${colaborador?.full_name}`,
              data_lancamento: dataPagamento,
              origem: 'escritorio',
              status: 'pago',
              created_by: user.user?.id
            });
        }
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
    setSelectedCargo(null);
    setItens({});
    setSugestoes({});
    setMesReferencia(format(new Date(), 'yyyy-MM'));
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    setDescricaoGeral('');
    setRateios([]);
    setUsarRateio(false);
    setContaId('');
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
                <ScrollArea className="max-h-[70vh]">
                  <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
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

                    {/* Alerta de Adiantamentos Pendentes */}
                    {adiantamentosPendentes.length > 0 && (
                      <Alert variant="destructive" className="border-amber-500 bg-amber-500/10">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-600">Adiantamentos Pendentes</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          Este colaborador possui {adiantamentosPendentes.length} adiantamento(s) pendente(s) 
                          totalizando {adiantamentosPendentes.reduce((acc, a) => acc + a.saldo_restante, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. 
                          Lembre-se de incluir o desconto!
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator />

                    {/* Vantagens */}
                    <div>
                      <h4 className="font-semibold text-green-600 mb-3">
                        Vantagens
                        {selectedCargo && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            ({selectedCargo.nome} - {selectedCargo.tipo === 'clt' ? 'CLT' : selectedCargo.tipo === 'socio' ? 'Sócio' : 'Advogado'})
                          </span>
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {getVantagensFiltradas().map(rubrica => (
                          <div key={rubrica.id} className="flex items-center gap-2">
                            <Label className="w-40 text-sm truncate" title={getRubricaLabel(rubrica)}>
                              {getRubricaLabel(rubrica)}
                            </Label>
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
                        {getDescontosFiltrados().map(rubrica => (
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

                    {/* Descrição Geral */}
                    <div className="space-y-2">
                      <Label>Descrição do Pagamento</Label>
                      <Textarea
                        placeholder="Descrição ou observações sobre o pagamento (ex: Reembolso de despesas, bonificação, etc.)"
                        value={descricaoGeral}
                        onChange={(e) => setDescricaoGeral(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <Separator />

                    {/* Lançamento Financeiro */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-semibold flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Lançar no Financeiro
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Conta de Saída</Label>
                          <Select value={contaId} onValueChange={setContaId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a conta..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contas.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Deixe vazio para não lançar no financeiro
                          </p>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <Label>Usar Rateio?</Label>
                            <p className="text-xs text-muted-foreground">
                              Dividir por categorias
                            </p>
                          </div>
                          <Switch 
                            checked={usarRateio} 
                            onCheckedChange={(checked) => {
                              setUsarRateio(checked);
                              if (checked && rateios.length === 0) {
                                setRateios([{
                                  id: crypto.randomUUID(),
                                  categoriaId: '',
                                  percentual: 100,
                                  valor: totais.liquido
                                }]);
                              }
                            }} 
                            disabled={!contaId}
                          />
                        </div>
                      </div>

                      {/* Rateio */}
                      {usarRateio && contaId && (
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <PieChart className="h-4 w-4" />
                              Rateio por Categoria
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setRateios([...rateios, {
                                id: crypto.randomUUID(),
                                categoriaId: '',
                                percentual: 0,
                                valor: 0
                              }])}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar
                            </Button>
                          </div>

                          {rateios.map((rateio, index) => (
                            <div key={rateio.id} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5">
                                <Select 
                                  value={rateio.categoriaId} 
                                  onValueChange={(v) => {
                                    setRateios(rateios.map(r => 
                                      r.id === rateio.id ? { ...r, categoriaId: v } : r
                                    ));
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Categoria" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categorias.map(c => (
                                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="%"
                                  className="h-9"
                                  value={rateio.percentual || ''}
                                  onChange={(e) => {
                                    const pct = parseFloat(e.target.value) || 0;
                                    setRateios(rateios.map(r => 
                                      r.id === rateio.id 
                                        ? { ...r, percentual: pct, valor: (totais.liquido * pct) / 100 } 
                                        : r
                                    ));
                                  }}
                                />
                              </div>
                              <div className="col-span-3">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Valor"
                                  className="h-9"
                                  value={rateio.valor?.toFixed(2) || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setRateios(rateios.map(r => 
                                      r.id === rateio.id 
                                        ? { ...r, valor: val, percentual: totais.liquido > 0 ? (val / totais.liquido) * 100 : 0 } 
                                        : r
                                    ));
                                  }}
                                />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => {
                                    if (rateios.length > 1) {
                                      setRateios(rateios.filter(r => r.id !== rateio.id));
                                    }
                                  }}
                                  disabled={rateios.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}

                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Total alocado:</span>
                            <span className={
                              Math.abs(rateios.reduce((acc, r) => acc + r.percentual, 0) - 100) < 0.1
                                ? 'text-green-600 font-medium'
                                : 'text-destructive font-medium'
                            }>
                              {rateios.reduce((acc, r) => acc + r.percentual, 0).toFixed(1)}%
                              {' '}({formatCurrency(rateios.reduce((acc, r) => acc + r.valor, 0))})
                            </span>
                          </div>
                        </div>
                      )}
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
