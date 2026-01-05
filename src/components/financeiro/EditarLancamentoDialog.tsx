import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, History, Paperclip } from 'lucide-react';
import { FinanceiroAnexos } from './FinanceiroAnexos';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EditarLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamentoId: string | null;
  onSuccess: () => void;
}

interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  descricao: string;
  data_lancamento: string;
  data_vencimento: string | null;
  status: string;
  origem: string | null;
  a_reembolsar: boolean;
  categoria_id: string | null;
  subcategoria_id: string | null;
  conta_origem_id: string | null;
  conta_destino_id: string | null;
  cliente_id: string | null;
  setor_id: string | null;
  centro_custo_id: string | null;
  produto_rd_station: string | null;
}

interface Historico {
  id: string;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
  usuario: { full_name: string } | null;
}

export function EditarLancamentoDialog({ open, onOpenChange, lancamentoId, onSuccess }: EditarLancamentoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');
  
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  
  // Dados de referência
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [subcategorias, setSubcategorias] = useState<{ id: string; nome: string }[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<{ id: string; nome: string }[]>([]);

  // Form state
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataLancamento, setDataLancamento] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [status, setStatus] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [contaOrigemId, setContaOrigemId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [setorId, setSetorId] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');
  const [aReembolsar, setAReembolsar] = useState(false);
  const [produtoRdStation, setProdutoRdStation] = useState('');

  useEffect(() => {
    if (open && lancamentoId) {
      fetchLancamento();
      fetchDados();
      fetchHistorico();
    }
  }, [open, lancamentoId]);

  const fetchDados = async () => {
    const [catRes, contaRes, clienteRes, setorRes, ccRes] = await Promise.all([
      supabase.from('fin_categorias').select('id, nome, tipo').eq('ativa', true).order('ordem'),
      supabase.from('fin_contas').select('id, nome').eq('ativa', true),
      supabase.from('fin_clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('fin_setores').select('id, nome').eq('ativo', true),
      supabase.from('fin_centros_custo').select('id, nome').eq('ativo', true)
    ]);

    setCategorias(catRes.data || []);
    setContas(contaRes.data || []);
    setClientes(clienteRes.data || []);
    setSetores(setorRes.data || []);
    setCentrosCusto(ccRes.data || []);
  };

  const fetchLancamento = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_lancamentos')
        .select('*')
        .eq('id', lancamentoId)
        .single();

      if (error) throw error;
      
      setLancamento(data);
      setValor(data.valor?.toString() || '');
      setDescricao(data.descricao || '');
      setDataLancamento(data.data_lancamento || '');
      setDataVencimento(data.data_vencimento || '');
      setStatus(data.status || '');
      setCategoriaId(data.categoria_id || '');
      setSubcategoriaId(data.subcategoria_id || '');
      setContaOrigemId(data.conta_origem_id || '');
      setClienteId(data.cliente_id || '');
      setSetorId(data.setor_id || '');
      setCentroCustoId(data.centro_custo_id || '');
      setAReembolsar(data.a_reembolsar || false);
      setProdutoRdStation(data.produto_rd_station || '');

      if (data.categoria_id) {
        const { data: subs } = await supabase
          .from('fin_subcategorias')
          .select('id, nome')
          .eq('categoria_id', data.categoria_id)
          .eq('ativa', true);
        setSubcategorias(subs || []);
      }
    } catch (error) {
      console.error('Erro ao carregar lançamento:', error);
      toast.error('Erro ao carregar lançamento');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    const { data } = await supabase
      .from('fin_auditoria')
      .select(`
        id,
        acao,
        dados_anteriores,
        dados_novos,
        created_at,
        usuario:profiles!fin_auditoria_usuario_id_fkey(full_name)
      `)
      .eq('registro_id', lancamentoId)
      .eq('tabela', 'fin_lancamentos')
      .order('created_at', { ascending: false });
    
    setHistorico((data as unknown as Historico[]) || []);
  };

  const handleCategoriaChange = async (catId: string) => {
    setCategoriaId(catId);
    setSubcategoriaId('');
    
    const { data } = await supabase
      .from('fin_subcategorias')
      .select('id, nome')
      .eq('categoria_id', catId)
      .eq('ativa', true);
    setSubcategorias(data || []);
  };

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('fin_lancamentos')
        .update({
          valor: parseFloat(valor),
          descricao: descricao.trim(),
          data_lancamento: dataLancamento,
          data_vencimento: dataVencimento || null,
          status,
          categoria_id: categoriaId || null,
          subcategoria_id: subcategoriaId || null,
          conta_origem_id: contaOrigemId || null,
          cliente_id: clienteId || null,
          setor_id: setorId || null,
          centro_custo_id: centroCustoId || null,
          a_reembolsar: aReembolsar,
          produto_rd_station: produtoRdStation || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', lancamentoId);

      if (error) throw error;

      toast.success('Lançamento atualizado com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar lançamento:', error);
      toast.error('Erro ao atualizar lançamento');
    } finally {
      setSubmitting(false);
    }
  };

  const categoriasFiltradas = categorias.filter(c => c.tipo === lancamento?.tipo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            Altere os dados do lançamento
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : lancamento ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="anexos">
                <Paperclip className="h-4 w-4 mr-2" />
                Anexos
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-2" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="anexos" className="mt-4">
              {lancamentoId && <FinanceiroAnexos lancamentoId={lancamentoId} />}
            </TabsContent>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-10"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago/Recebido</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Lançamento</Label>
                  <Input
                    type="date"
                    value={dataLancamento}
                    onChange={(e) => setDataLancamento(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoriaId} onValueChange={handleCategoriaChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasFiltradas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subcategorias.length > 0 && (
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <Select value={subcategoriaId} onValueChange={setSubcategoriaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategorias.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Select value={contaOrigemId} onValueChange={setContaOrigemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {centrosCusto.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {lancamento.origem === 'cliente' && (
                <>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>A Reembolsar?</Label>
                      <p className="text-sm text-muted-foreground">
                        Marque se esta despesa deve ser cobrada do cliente
                      </p>
                    </div>
                    <Switch checked={aReembolsar} onCheckedChange={setAReembolsar} />
                  </div>
                </>
              )}

              {lancamento.origem === 'escritorio' && (
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={setorId} onValueChange={setSetorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Produto RD Station</Label>
                <Input
                  value={produtoRdStation}
                  onChange={(e) => setProdutoRdStation(e.target.value)}
                  placeholder="Nome do produto no RD Station"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <div className="space-y-4">
                {historico.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum histórico de alterações
                  </p>
                ) : (
                  historico.map((h) => (
                    <div key={h.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{h.acao}</span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {h.usuario && (
                        <p className="text-sm text-muted-foreground">
                          Por: {h.usuario.full_name}
                        </p>
                      )}
                      {h.dados_anteriores && (
                        <details className="mt-2">
                          <summary className="text-sm cursor-pointer text-muted-foreground">
                            Ver detalhes
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(h.dados_anteriores, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Lançamento não encontrado
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
