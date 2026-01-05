import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ArrowLeftRight,
  Building2,
  Users,
  Loader2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface NovoLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  grupo: string;
  cor: string;
}

interface Subcategoria {
  id: string;
  nome: string;
  categoria_id: string;
}

interface Conta {
  id: string;
  nome: string;
  tipo: string;
}

interface Cliente {
  id: string;
  nome: string;
}

interface Setor {
  id: string;
  nome: string;
}

export function NovoLancamentoDialog({ open, onOpenChange, onSuccess }: NovoLancamentoDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dados de referência
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  // Dados do formulário
  const [tipo, setTipo] = useState<'receita' | 'despesa' | 'transferencia'>('despesa');
  const [origem, setOrigem] = useState<'escritorio' | 'cliente'>('escritorio');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [contaOrigemId, setContaOrigemId] = useState('');
  const [contaDestinoId, setContaDestinoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [setorId, setSetorId] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [aReembolsar, setAReembolsar] = useState(false);
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago');
  const [produtoRdStation, setProdutoRdStation] = useState('');
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState('2');
  useEffect(() => {
    if (open) {
      fetchDados();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setStep(1);
    setTipo('despesa');
    setOrigem('escritorio');
    setCategoriaId('');
    setSubcategoriaId('');
    setContaOrigemId('');
    setContaDestinoId('');
    setClienteId('');
    setSetorId('');
    setValor('');
    setDescricao('');
    setDataLancamento(new Date().toISOString().split('T')[0]);
    setAReembolsar(false);
    setStatus('pago');
    setProdutoRdStation('');
    setParcelado(false);
    setNumeroParcelas('2');
  };

  const fetchDados = async () => {
    setLoading(true);
    try {
      const [catRes, contaRes, clienteRes, setorRes] = await Promise.all([
        supabase.from('fin_categorias').select('*').eq('ativa', true).order('ordem'),
        supabase.from('fin_contas').select('*').eq('ativa', true),
        supabase.from('fin_clientes').select('*').eq('ativo', true).order('nome'),
        supabase.from('fin_setores').select('*').eq('ativo', true)
      ]);

      setCategorias(catRes.data || []);
      setContas(contaRes.data || []);
      setClientes(clienteRes.data || []);
      setSetores(setorRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategorias = async (catId: string) => {
    const { data } = await supabase
      .from('fin_subcategorias')
      .select('*')
      .eq('categoria_id', catId)
      .eq('ativa', true);
    setSubcategorias(data || []);
  };

  useEffect(() => {
    if (categoriaId) {
      fetchSubcategorias(categoriaId);
      setSubcategoriaId('');
    }
  }, [categoriaId]);

  const categoriasFiltradas = categorias.filter(c => {
    if (tipo === 'receita') return c.tipo === 'receita';
    if (tipo === 'despesa') {
      if (origem === 'cliente') {
        return c.nome === 'Gastos com Clientes';
      }
      return c.tipo === 'despesa';
    }
    return false;
  });

  const handleSubmit = async (salvarENovo: boolean = false) => {
    // Validações
    if (!descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    if (!contaOrigemId) {
      toast.error('Selecione uma conta');
      return;
    }
    if (tipo === 'despesa' && origem === 'cliente' && !clienteId) {
      toast.error('Selecione um cliente');
      return;
    }
    if (tipo === 'despesa' && origem === 'escritorio' && !setorId) {
      toast.error('Selecione o setor responsável pela despesa');
      return;
    }
    if (tipo === 'transferencia' && contaOrigemId === contaDestinoId) {
      toast.error('Conta de origem e destino não podem ser iguais');
      return;
    }

    setSubmitting(true);
    try {
      const valorTotal = parseFloat(valor);
      const totalParcelas = parcelado ? parseInt(numeroParcelas) : 1;
      const valorParcela = valorTotal / totalParcelas;

      if (parcelado && totalParcelas > 1) {
        // Criar lançamento pai
        const { data: lancamentoPai, error: erroPai } = await supabase
          .from('fin_lancamentos')
          .insert({
            tipo,
            categoria_id: categoriaId || null,
            subcategoria_id: subcategoriaId || null,
            conta_origem_id: contaOrigemId,
            conta_destino_id: tipo === 'transferencia' ? contaDestinoId : null,
            cliente_id: origem === 'cliente' ? clienteId : null,
            setor_id: origem === 'escritorio' ? setorId || null : null,
            valor: valorTotal,
            descricao: `${descricao.trim()} (Total ${totalParcelas}x)`,
            data_lancamento: dataLancamento,
            origem: tipo === 'despesa' ? origem : null,
            a_reembolsar: origem === 'cliente' ? aReembolsar : false,
            status: 'pendente',
            produto_rd_station: tipo === 'receita' ? produtoRdStation || null : null,
            total_parcelas: totalParcelas,
            created_by: user?.id
          })
          .select()
          .single();

        if (erroPai) throw erroPai;

        // Criar parcelas individuais
        const parcelas = [];
        for (let i = 1; i <= totalParcelas; i++) {
          const dataParcela = new Date(dataLancamento);
          dataParcela.setMonth(dataParcela.getMonth() + (i - 1));
          
          parcelas.push({
            tipo,
            categoria_id: categoriaId || null,
            subcategoria_id: subcategoriaId || null,
            conta_origem_id: contaOrigemId,
            conta_destino_id: tipo === 'transferencia' ? contaDestinoId : null,
            cliente_id: origem === 'cliente' ? clienteId : null,
            setor_id: origem === 'escritorio' ? setorId || null : null,
            valor: valorParcela,
            descricao: `${descricao.trim()} (${i}/${totalParcelas})`,
            data_lancamento: dataParcela.toISOString().split('T')[0],
            origem: tipo === 'despesa' ? origem : null,
            a_reembolsar: origem === 'cliente' ? aReembolsar : false,
            status: i === 1 ? status : 'pendente',
            produto_rd_station: tipo === 'receita' ? produtoRdStation || null : null,
            parcela_atual: i,
            total_parcelas: totalParcelas,
            lancamento_pai_id: lancamentoPai.id,
            created_by: user?.id
          });
        }

        const { error: erroParcelas } = await supabase
          .from('fin_lancamentos')
          .insert(parcelas);

        if (erroParcelas) throw erroParcelas;

        toast.success(`${totalParcelas} parcelas criadas com sucesso!`);
      } else {
        // Lançamento único (sem parcelamento)
        const lancamento = {
          tipo,
          categoria_id: categoriaId || null,
          subcategoria_id: subcategoriaId || null,
          conta_origem_id: contaOrigemId,
          conta_destino_id: tipo === 'transferencia' ? contaDestinoId : null,
          cliente_id: origem === 'cliente' ? clienteId : null,
          setor_id: origem === 'escritorio' ? setorId || null : null,
          valor: valorTotal,
          descricao: descricao.trim(),
          data_lancamento: dataLancamento,
          origem: tipo === 'despesa' ? origem : null,
          a_reembolsar: origem === 'cliente' ? aReembolsar : false,
          status,
          produto_rd_station: tipo === 'receita' ? produtoRdStation || null : null,
          created_by: user?.id
        };

        const { error } = await supabase
          .from('fin_lancamentos')
          .insert(lancamento);

        if (error) throw error;
        toast.success('Lançamento criado com sucesso!');
      }
      
      if (salvarENovo) {
        // Limpa apenas os campos do formulário, mantém tipo e origem
        setCategoriaId('');
        setSubcategoriaId('');
        setValor('');
        setDescricao('');
        setDataLancamento(new Date().toISOString().split('T')[0]);
        setAReembolsar(false);
        setStatus('pago');
        setProdutoRdStation('');
        setParcelado(false);
        setNumeroParcelas('2');
        toast.info('Pronto para novo lançamento');
      } else {
        onSuccess();
      }
    } catch (error) {
      console.error('Erro ao criar lançamento:', error);
      toast.error('Erro ao criar lançamento');
    } finally {
      setSubmitting(false);
    }
  };

  const formatValor = (v: string) => {
    const num = v.replace(/\D/g, '');
    if (!num) return '';
    return (parseInt(num) / 100).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Selecione o tipo de lançamento'}
            {step === 2 && tipo === 'despesa' && 'Selecione a origem da despesa'}
            {step === 3 && 'Preencha os detalhes do lançamento'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Tipo */}
            {step === 1 && (
              <div className="space-y-4">
                <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <div className="grid grid-cols-3 gap-4">
                    <Label 
                      htmlFor="receita" 
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent ${
                        tipo === 'receita' ? 'border-green-500 bg-green-500/10' : ''
                      }`}
                    >
                      <RadioGroupItem value="receita" id="receita" className="sr-only" />
                      <ArrowUpCircle className="h-8 w-8 text-green-500" />
                      <span className="font-medium">Receita</span>
                    </Label>
                    <Label 
                      htmlFor="despesa" 
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent ${
                        tipo === 'despesa' ? 'border-red-500 bg-red-500/10' : ''
                      }`}
                    >
                      <RadioGroupItem value="despesa" id="despesa" className="sr-only" />
                      <ArrowDownCircle className="h-8 w-8 text-red-500" />
                      <span className="font-medium">Despesa</span>
                    </Label>
                    <Label 
                      htmlFor="transferencia" 
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent ${
                        tipo === 'transferencia' ? 'border-blue-500 bg-blue-500/10' : ''
                      }`}
                    >
                      <RadioGroupItem value="transferencia" id="transferencia" className="sr-only" />
                      <ArrowLeftRight className="h-8 w-8 text-blue-500" />
                      <span className="font-medium">Transferência</span>
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex justify-end">
                  <Button onClick={() => setStep(tipo === 'despesa' ? 2 : 3)}>
                    Próximo <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Origem (só para despesas) */}
            {step === 2 && tipo === 'despesa' && (
              <div className="space-y-4">
                <RadioGroup value={origem} onValueChange={(v) => setOrigem(v as typeof origem)}>
                  <div className="grid grid-cols-2 gap-4">
                    <Label 
                      htmlFor="escritorio" 
                      className={`flex flex-col items-center gap-2 p-6 border-2 rounded-lg cursor-pointer hover:bg-accent ${
                        origem === 'escritorio' ? 'border-primary bg-primary/10' : ''
                      }`}
                    >
                      <RadioGroupItem value="escritorio" id="escritorio" className="sr-only" />
                      <Building2 className="h-10 w-10 text-primary" />
                      <span className="font-medium">Escritório</span>
                      <span className="text-xs text-muted-foreground text-center">
                        Despesas operacionais do escritório
                      </span>
                    </Label>
                    <Label 
                      htmlFor="cliente" 
                      className={`flex flex-col items-center gap-2 p-6 border-2 rounded-lg cursor-pointer hover:bg-accent ${
                        origem === 'cliente' ? 'border-primary bg-primary/10' : ''
                      }`}
                    >
                      <RadioGroupItem value="cliente" id="cliente" className="sr-only" />
                      <Users className="h-10 w-10 text-primary" />
                      <span className="font-medium">Cliente</span>
                      <span className="text-xs text-muted-foreground text-center">
                        Despesas pagas em nome de cliente
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(3)}>
                    Próximo <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Formulário completo */}
            {step === 3 && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Cliente (se despesa de cliente) */}
                {tipo === 'despesa' && origem === 'cliente' && (
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Categoria */}
                {tipo !== 'transferencia' && (
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasFiltradas.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Subcategoria */}
                {subcategorias.length > 0 && (
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <Select value={subcategoriaId} onValueChange={setSubcategoriaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a subcategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategorias.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Valor */}
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      className="pl-10"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Textarea
                    placeholder="Descreva o lançamento..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Data */}
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={dataLancamento}
                    onChange={(e) => setDataLancamento(e.target.value)}
                  />
                </div>

                {/* Conta de Origem */}
                <div className="space-y-2">
                  <Label>{tipo === 'transferencia' ? 'Conta de Origem *' : 'Conta *'}</Label>
                  <Select value={contaOrigemId} onValueChange={setContaOrigemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conta de Destino (transferência) */}
                {tipo === 'transferencia' && (
                  <div className="space-y-2">
                    <Label>Conta de Destino *</Label>
                    <Select value={contaDestinoId} onValueChange={setContaDestinoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.filter(c => c.id !== contaOrigemId).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Setor (se despesa de escritório) */}
                {tipo === 'despesa' && origem === 'escritorio' && (
                  <div className="space-y-2">
                    <Label>Setor *</Label>
                    <Select value={setorId} onValueChange={setSetorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {setores.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecione o setor para análise de gastos por área
                    </p>
                  </div>
                )}

                {/* A Reembolsar (se despesa de cliente) */}
                {tipo === 'despesa' && origem === 'cliente' && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>A Reembolsar?</Label>
                      <p className="text-sm text-muted-foreground">
                        Marque se esta despesa deve ser cobrada do cliente
                      </p>
                    </div>
                    <Switch checked={aReembolsar} onCheckedChange={setAReembolsar} />
                  </div>
                )}

                {/* Produto RD Station (se receita) */}
                {tipo === 'receita' && (
                  <div className="space-y-2">
                    <Label>Produto RD Station (opcional)</Label>
                    <Input
                      placeholder="Ex: Honorários INSS, Trabalhista..."
                      value={produtoRdStation}
                      onChange={(e) => setProdutoRdStation(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome do produto conforme cadastrado no RD Station
                    </p>
                  </div>
                )}

                {/* Parcelamento */}
                {tipo !== 'transferencia' && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Parcelar?</Label>
                        <p className="text-sm text-muted-foreground">
                          Dividir em múltiplas parcelas mensais
                        </p>
                      </div>
                      <Switch checked={parcelado} onCheckedChange={setParcelado} />
                    </div>
                    
                    {parcelado && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Número de Parcelas</Label>
                          <Select value={numeroParcelas} onValueChange={setNumeroParcelas}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Valor por Parcela</Label>
                          <div className="p-2 bg-muted rounded text-center font-medium">
                            {valor ? `R$ ${(parseFloat(valor) / parseInt(numeroParcelas)).toFixed(2)}` : 'R$ 0,00'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status {parcelado && '(primeira parcela)'}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago/Recebido</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(tipo === 'despesa' ? 2 : 1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar e Novo
                    </Button>
                    <Button onClick={() => handleSubmit(false)} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
