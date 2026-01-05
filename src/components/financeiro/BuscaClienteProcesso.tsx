import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Briefcase, ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
}

interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  descricao: string;
  data_lancamento: string;
  status: string;
  categoria: { nome: string } | null;
}

interface LancamentosResumo {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  lancamentos: Lancamento[];
}

interface BuscaClienteProcessoProps {
  onSelectCliente?: (clienteId: string) => void;
}

export function BuscaClienteProcesso({ onSelectCliente }: BuscaClienteProcessoProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [lancamentosData, setLancamentosData] = useState<LancamentosResumo | null>(null);
  const [loadingLancamentos, setLoadingLancamentos] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!busca.trim() || busca.length < 2) {
      setClientes([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_clientes')
        .select('id, nome, cpf_cnpj, email, telefone')
        .or(`nome.ilike.%${busca}%,cpf_cnpj.ilike.%${busca}%,email.ilike.%${busca}%`)
        .eq('ativo', true)
        .limit(20);

      if (error) throw error;
      setClientes((data || []) as Cliente[]);
    } catch (error) {
      console.error('Erro na busca:', error);
      toast.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [busca, handleSearch]);

  const fetchLancamentosCliente = async (clienteId: string) => {
    setLoadingLancamentos(true);
    try {
      const { data, error } = await supabase
        .from('fin_lancamentos')
        .select(`
          id,
          tipo,
          valor,
          descricao,
          data_lancamento,
          status,
          categoria:fin_categorias(nome)
        `)
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data_lancamento', { ascending: false })
        .limit(50);

      if (error) throw error;

      const lancamentos = data as Lancamento[];
      const totalReceitas = lancamentos
        .filter(l => l.tipo === 'receita' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0);
      const totalDespesas = lancamentos
        .filter(l => l.tipo === 'despesa' && l.status === 'pago')
        .reduce((acc, l) => acc + Number(l.valor), 0);

      setLancamentosData({
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        lancamentos
      });
    } catch (error) {
      console.error('Erro ao buscar lançamentos:', error);
      toast.error('Erro ao buscar lançamentos do cliente');
    } finally {
      setLoadingLancamentos(false);
    }
  };

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    fetchLancamentosCliente(cliente.id);
    onSelectCliente?.(cliente.id);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="h-4 w-4 mr-2" />
          Buscar Cliente/Processo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Buscar por Cliente ou Processo</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coluna de busca */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite nome, CPF/CNPJ ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : clientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {busca.length < 2 
                      ? 'Digite pelo menos 2 caracteres para buscar'
                      : 'Nenhum cliente encontrado'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {clientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedCliente?.id === cliente.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSelectCliente(cliente)}
                    >
                      <div className="font-medium">{cliente.nome}</div>
                      <div className="text-sm opacity-80">
                        {cliente.cpf_cnpj && <span>{cliente.cpf_cnpj}</span>}
                        {cliente.email && <span className="ml-2">• {cliente.email}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Coluna de detalhes */}
          <div className="space-y-4">
            {selectedCliente ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{selectedCliente.nome}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {selectedCliente.cpf_cnpj}
                      {selectedCliente.email && <span> • {selectedCliente.email}</span>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingLancamentos ? (
                      <div className="flex items-center justify-center h-16">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : lancamentosData ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Receitas</div>
                          <div className="text-lg font-semibold text-green-600">
                            {formatCurrency(lancamentosData.totalReceitas)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Despesas</div>
                          <div className="text-lg font-semibold text-red-600">
                            {formatCurrency(lancamentosData.totalDespesas)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Saldo</div>
                          <div className={`text-lg font-semibold ${
                            lancamentosData.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(lancamentosData.saldo)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {lancamentosData && (
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <div className="p-2">
                      <h4 className="font-medium text-sm mb-2 px-2">Últimos Lançamentos</h4>
                      {lancamentosData.lancamentos.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum lançamento encontrado
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {lancamentosData.lancamentos.map((l) => (
                            <div key={l.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                              <div className="flex items-center gap-2">
                                {l.tipo === 'receita' ? (
                                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                                )}
                                <div>
                                  <div className="text-sm font-medium truncate max-w-[150px]">
                                    {l.descricao}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(l.data_lancamento), 'dd/MM/yyyy')}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`font-medium ${
                                  l.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {l.tipo === 'despesa' && '-'}
                                  {formatCurrency(l.valor)}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {l.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <Users className="h-12 w-12 mb-4 opacity-30" />
                <p>Selecione um cliente para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
