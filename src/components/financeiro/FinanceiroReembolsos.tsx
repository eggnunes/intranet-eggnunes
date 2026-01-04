import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertCircle,
  CheckCircle,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DespesaReembolso {
  id: string;
  valor: number;
  descricao: string;
  data_lancamento: string;
  reembolsada: boolean;
  data_reembolso: string | null;
  categoria: { nome: string } | null;
  cliente: { id: string; nome: string } | null;
}

interface ClienteAgrupado {
  cliente_id: string;
  cliente_nome: string;
  despesas: DespesaReembolso[];
  total: number;
}

export function FinanceiroReembolsos() {
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'pendentes' | 'reembolsadas'>('pendentes');
  const [despesasAgrupadas, setDespesasAgrupadas] = useState<ClienteAgrupado[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const fetchReembolsos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_lancamentos')
        .select(`
          id,
          valor,
          descricao,
          data_lancamento,
          reembolsada,
          data_reembolso,
          categoria:fin_categorias(nome),
          cliente:fin_clientes(id, nome)
        `)
        .eq('a_reembolsar', true)
        .eq('reembolsada', filtroStatus === 'reembolsadas')
        .is('deleted_at', null)
        .order('data_lancamento', { ascending: false });

      if (error) throw error;

      // Agrupar por cliente
      const agrupado = new Map<string, ClienteAgrupado>();
      
      (data as DespesaReembolso[] || []).forEach(despesa => {
        const clienteId = despesa.cliente?.id || 'sem_cliente';
        const clienteNome = despesa.cliente?.nome || 'Sem Cliente';
        
        if (!agrupado.has(clienteId)) {
          agrupado.set(clienteId, {
            cliente_id: clienteId,
            cliente_nome: clienteNome,
            despesas: [],
            total: 0
          });
        }
        
        const grupo = agrupado.get(clienteId)!;
        grupo.despesas.push(despesa);
        grupo.total += Number(despesa.valor);
      });

      setDespesasAgrupadas(Array.from(agrupado.values()));
    } catch (error) {
      console.error('Erro ao carregar reembolsos:', error);
      toast.error('Erro ao carregar despesas a reembolsar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReembolsos();
    setSelecionadas(new Set());
  }, [filtroStatus]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const toggleSelecionada = (id: string) => {
    const novas = new Set(selecionadas);
    if (novas.has(id)) {
      novas.delete(id);
    } else {
      novas.add(id);
    }
    setSelecionadas(novas);
  };

  const selecionarTodasDoCliente = (despesas: DespesaReembolso[]) => {
    const novas = new Set(selecionadas);
    const todasSelecionadas = despesas.every(d => novas.has(d.id));
    
    if (todasSelecionadas) {
      despesas.forEach(d => novas.delete(d.id));
    } else {
      despesas.forEach(d => novas.add(d.id));
    }
    
    setSelecionadas(novas);
  };

  const marcarComoReembolsadas = async () => {
    if (selecionadas.size === 0) {
      toast.warning('Selecione pelo menos uma despesa');
      return;
    }

    try {
      const { error } = await supabase
        .from('fin_lancamentos')
        .update({
          reembolsada: true,
          data_reembolso: new Date().toISOString().split('T')[0]
        })
        .in('id', Array.from(selecionadas));

      if (error) throw error;

      toast.success(`${selecionadas.size} despesa(s) marcada(s) como reembolsada(s)`);
      setSelecionadas(new Set());
      fetchReembolsos();
    } catch (error) {
      console.error('Erro ao marcar reembolsos:', error);
      toast.error('Erro ao atualizar despesas');
    }
  };

  const totalGeral = despesasAgrupadas.reduce((acc, g) => acc + g.total, 0);
  const totalSelecionado = despesasAgrupadas
    .flatMap(g => g.despesas)
    .filter(d => selecionadas.has(d.id))
    .reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total a Reembolsar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(filtroStatus === 'pendentes' ? totalGeral : 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {despesasAgrupadas.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Selecionado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalSelecionado)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Despesas de Clientes</CardTitle>
              <CardDescription>
                Controle de despesas pagas em nome de clientes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as 'pendentes' | 'reembolsadas')}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendentes">A Reembolsar</SelectItem>
                  <SelectItem value="reembolsadas">Reembolsadas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchReembolsos}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {filtroStatus === 'pendentes' && selecionadas.size > 0 && (
                <Button onClick={marcarComoReembolsadas}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Reembolsadas ({selecionadas.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : despesasAgrupadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma despesa {filtroStatus === 'pendentes' ? 'pendente de reembolso' : 'reembolsada'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {despesasAgrupadas.map((grupo) => (
                <div key={grupo.cliente_id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {filtroStatus === 'pendentes' && (
                        <Checkbox
                          checked={grupo.despesas.every(d => selecionadas.has(d.id))}
                          onCheckedChange={() => selecionarTodasDoCliente(grupo.despesas)}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{grupo.cliente_nome}</h3>
                        <p className="text-sm text-muted-foreground">
                          {grupo.despesas.length} despesa(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-orange-600">
                        {formatCurrency(grupo.total)}
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {filtroStatus === 'pendentes' && <TableHead className="w-[40px]"></TableHead>}
                        <TableHead>Data</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        {filtroStatus === 'reembolsadas' && <TableHead>Data Reembolso</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.despesas.map((despesa) => (
                        <TableRow key={despesa.id}>
                          {filtroStatus === 'pendentes' && (
                            <TableCell>
                              <Checkbox
                                checked={selecionadas.has(despesa.id)}
                                onCheckedChange={() => toggleSelecionada(despesa.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {format(new Date(despesa.data_lancamento), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {despesa.categoria?.nome || 'Sem categoria'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {despesa.descricao}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(despesa.valor)}
                          </TableCell>
                          {filtroStatus === 'reembolsadas' && (
                            <TableCell>
                              {despesa.data_reembolso 
                                ? format(new Date(despesa.data_reembolso), 'dd/MM/yyyy')
                                : '-'
                              }
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
