import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, DollarSign, Briefcase, Calendar, CheckSquare, Award, FileText, Eye, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subMonths, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Colaborador {
  id: string;
  full_name: string;
  email: string;
  position: string;
  avatar_url: string | null;
  join_date: string | null;
  salario: number | null;
  cargo_id: string | null;
  cargo_nome?: string;
  cargo_valor_base?: number;
}

interface PagamentoMensal {
  mes: string;
  total_liquido: number;
  total_vantagens: number;
  total_descontos: number;
}

interface Promocao {
  id: string;
  cargo_anterior_nome: string;
  cargo_novo_nome: string;
  data_promocao: string;
  observacoes: string | null;
}

interface PontuacaoAdvbox {
  mes: string;
  tarefas_concluidas: number;
  tarefas_atribuidas: number;
  percentual_conclusao: number;
  pontos: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#a4de6c'];

export function RHColaboradorDashboard() {
  const navigate = useNavigate();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Dados do colaborador selecionado
  const [pagamentosMensais, setPagamentosMensais] = useState<PagamentoMensal[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [pontuacaoAdvbox, setPontuacaoAdvbox] = useState<PontuacaoAdvbox[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  useEffect(() => {
    if (selectedColaborador) {
      fetchColaboradorDetails(selectedColaborador);
    }
  }, [selectedColaborador]);

  const fetchColaboradores = async () => {
    try {
      const { data: colabData, error: colabError } = await supabase
        .from('profiles')
        .select('id, full_name, email, position, avatar_url, join_date, salario, cargo_id')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .order('full_name');

      if (colabError) throw colabError;

      // Buscar cargos para mapear
      const cargoIds = [...new Set((colabData || []).filter(c => c.cargo_id).map(c => c.cargo_id))];
      let cargosMap = new Map();
      
      if (cargoIds.length > 0) {
        const { data: cargosData } = await supabase
          .from('rh_cargos')
          .select('id, nome, valor_base')
          .in('id', cargoIds);
        
        cargosMap = new Map((cargosData || []).map(c => [c.id, c]));
      }

      const colaboradoresWithCargos = (colabData || []).map(c => {
        const cargo = c.cargo_id ? cargosMap.get(c.cargo_id) : null;
        return {
          ...c,
          cargo_nome: cargo?.nome || null,
          cargo_valor_base: cargo?.valor_base || null
        };
      });

      setColaboradores(colaboradoresWithCargos as Colaborador[]);
    } catch (error: any) {
      toast.error('Erro ao carregar colaboradores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchColaboradorDetails = async (colaboradorId: string) => {
    setLoadingDetails(true);
    try {
      // Buscar pagamentos dos últimos 12 meses
      const startDate = format(subMonths(new Date(), 12), 'yyyy-MM-dd');
      
      const [pagamentosRes, promocoesRes] = await Promise.all([
        supabase
          .from('rh_pagamentos')
          .select('mes_referencia, total_liquido, total_vantagens, total_descontos')
          .eq('colaborador_id', colaboradorId)
          .gte('mes_referencia', startDate)
          .order('mes_referencia', { ascending: true }),
        supabase
          .from('rh_promocoes')
          .select('id, cargo_anterior_nome, cargo_novo_nome, data_promocao, observacoes')
          .eq('colaborador_id', colaboradorId)
          .order('data_promocao', { ascending: false })
      ]);

      if (pagamentosRes.error) throw pagamentosRes.error;
      if (promocoesRes.error) throw promocoesRes.error;

      // Formatar pagamentos para o gráfico
      const pagamentosFormatados = (pagamentosRes.data || []).map(p => ({
        mes: format(new Date(p.mes_referencia), 'MMM/yy', { locale: ptBR }),
        total_liquido: p.total_liquido,
        total_vantagens: p.total_vantagens,
        total_descontos: p.total_descontos
      }));

      setPagamentosMensais(pagamentosFormatados);
      setPromocoes(promocoesRes.data || []);

      // Buscar pontuação do ADVBOX (tarefas)
      await fetchPontuacaoAdvbox(colaboradorId);
    } catch (error: any) {
      toast.error('Erro ao carregar detalhes: ' + error.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchPontuacaoAdvbox = async (colaboradorId: string) => {
    try {
      // Buscar email do colaborador
      const colaborador = colaboradores.find(c => c.id === colaboradorId);
      if (!colaborador) return;

      // Usar o novo endpoint que já filtra e calcula estatísticas
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks-by-user', {
        body: { user_name: colaborador.full_name }
      });

      if (error) {
        console.error('Erro ao buscar tarefas ADVBOX:', error);
        return;
      }

      const resultado = data?.data;
      if (!resultado) {
        console.log('Nenhum dado de tarefas retornado');
        return;
      }

      // Formatar estatísticas mensais para o gráfico
      const estatisticas = resultado.estatisticas_mensais || [];
      const pontuacaoFormatada = estatisticas.map((item: any) => {
        // Converter YYYY-MM para formato legível
        const [ano, mes] = item.mes.split('-');
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const mesNome = meses[parseInt(mes) - 1] || mes;
        
        return {
          mes: `${mesNome}/${ano.slice(2)}`,
          tarefas_concluidas: item.tarefas_concluidas,
          tarefas_atribuidas: item.tarefas_atribuidas,
          percentual_conclusao: item.percentual_conclusao,
          pontos: item.pontos || 0
        };
      });

      console.log(`Tarefas encontradas para ${colaborador.full_name}:`, resultado.total_tarefas);
      setPontuacaoAdvbox(pontuacaoFormatada);
    } catch (error) {
      console.error('Erro ao buscar pontuação ADVBOX:', error);
    }
  };

  const getPositionLabel = (position: string) => {
    const labels: Record<string, string> = {
      'socio': 'Sócio',
      'advogado': 'Advogado',
      'estagiario': 'Estagiário',
      'comercial': 'Comercial',
      'administrativo': 'Administrativo'
    };
    return labels[position] || position;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const currentColaborador = colaboradores.find(c => c.id === selectedColaborador);
  const totalPago = pagamentosMensais.reduce((acc, p) => acc + p.total_liquido, 0);
  const mediaMensal = pagamentosMensais.length > 0 ? totalPago / pagamentosMensais.length : 0;
  const totalTarefasConcluidas = pontuacaoAdvbox.reduce((acc, p) => acc + p.tarefas_concluidas, 0);
  const totalTarefas = pontuacaoAdvbox.reduce((acc, p) => acc + p.tarefas_atribuidas, 0);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Seletor de Colaborador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Dashboard Individual de Colaborador
          </CardTitle>
          <CardDescription>
            Selecione um colaborador para visualizar seu dashboard completo com histórico de pagamentos, promoções e pontuação de tarefas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Selecione um colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {c.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedColaborador && currentColaborador && (
        <>
          {/* Cabeçalho do Colaborador */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20 border-4 border-primary/30">
                  <AvatarImage src={currentColaborador.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-2xl">
                    {currentColaborador.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{currentColaborador.full_name}</h2>
                  <p className="text-muted-foreground">{currentColaborador.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge>{getPositionLabel(currentColaborador.position)}</Badge>
                    {currentColaborador.cargo_nome && (
                      <Badge variant="outline">{currentColaborador.cargo_nome}</Badge>
                    )}
                    {currentColaborador.join_date && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Desde {format(parse(currentColaborador.join_date, 'yyyy-MM-dd', new Date()), "MMM/yyyy", { locale: ptBR })}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  {currentColaborador.salario && (
                    <div>
                      <p className="text-sm text-muted-foreground">Salário Atual</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(currentColaborador.salario)}
                      </p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/rh?colaboradorId=${selectedColaborador}`)}
                    className="mt-2"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Perfil Completo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingDetails ? (
            <div className="flex items-center justify-center p-8">Carregando detalhes...</div>
          ) : (
            <>
              {/* Cards de Métricas */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Pago (12 meses)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalPago)}</div>
                    <p className="text-xs text-muted-foreground">
                      Média: {formatCurrency(mediaMensal)}/mês
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Promoções</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{promocoes.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {promocoes.length > 0 
                        ? `Última: ${format(parse(promocoes[0].data_promocao, 'yyyy-MM-dd', new Date()), "MMM/yyyy", { locale: ptBR })}`
                        : 'Nenhuma promoção registrada'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tarefas ADVBOX</CardTitle>
                    <CheckSquare className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTarefasConcluidas}/{totalTarefas}</div>
                    <p className="text-xs text-muted-foreground">
                      {totalTarefas > 0 
                        ? `${Math.round((totalTarefasConcluidas / totalTarefas) * 100)}% concluídas`
                        : 'Sem dados de tarefas'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pagamentos Registrados</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pagamentosMensais.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Últimos 12 meses
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Gráfico de Pagamentos Mensais */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Evolução de Pagamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pagamentosMensais.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={pagamentosMensais}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mes" />
                          <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="total_liquido" name="Líquido" stroke="#22c55e" strokeWidth={2} />
                          <Line type="monotone" dataKey="total_vantagens" name="Vantagens" stroke="#3b82f6" strokeWidth={2} />
                          <Line type="monotone" dataKey="total_descontos" name="Descontos" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        Nenhum pagamento registrado
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Gráfico de Pontuação ADVBOX */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5" />
                      Pontuação Mensal ADVBOX
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pontuacaoAdvbox.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={pontuacaoAdvbox}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mes" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="tarefas_concluidas" name="Concluídas" fill="#22c55e" />
                          <Bar dataKey="tarefas_atribuidas" name="Atribuídas" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        Sem dados de tarefas ADVBOX
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Histórico de Promoções */}
              {promocoes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Histórico de Promoções
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {promocoes.map((promo) => (
                        <div key={promo.id} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                          <Award className="h-5 w-5 text-yellow-500 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{promo.cargo_anterior_nome}</Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {promo.cargo_novo_nome}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(parse(promo.data_promocao, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            {promo.observacoes && (
                              <p className="text-sm mt-1">{promo.observacoes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela de Pagamentos */}
              {pagamentosMensais.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Detalhamento de Pagamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Vantagens</TableHead>
                          <TableHead className="text-right">Descontos</TableHead>
                          <TableHead className="text-right">Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagamentosMensais.map((pag, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{pag.mes}</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(pag.total_vantagens)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              -{formatCurrency(pag.total_descontos)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(pag.total_liquido)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
