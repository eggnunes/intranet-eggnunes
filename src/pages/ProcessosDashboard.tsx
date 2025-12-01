import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase, AlertCircle, TrendingUp, Search, Filter, Calendar, BarChart, ListTodo } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lawsuit {
  id: number;
  process_number: string;
  protocol_number: string | null;
  folder: string | null;
  process_date: string | null;
  fees_expec: number | null;
  fees_money: number | null;
  contingency: number | null;
  type_lawsuit_id: number;
  type: string;
  group_id: number;
  group: string;
  created_at: string;
  status_closure: string | null;
  exit_production: string | null;
  exit_execution: string | null;
  responsible_id: number;
  responsible: string;
  customers?: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

interface Movement {
  lawsuit_id: number;
  date: string;
  title: string;
  header: string;
  process_number: string;
  protocol_number: string | null;
  customers: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

export default function ProcessosDashboard() {
  const CACHE_KEY = 'advbox-processos-cache';
  const CACHE_TIMESTAMP_KEY = 'advbox-processos-cache-timestamp';
  
  // Carregar dados do cache imediatamente
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (cached && timestamp) {
        const data = JSON.parse(cached);
        return {
          ...data,
          lastUpdate: new Date(timestamp)
        };
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
    }
    return null;
  };

  const cachedData = loadFromCache();
  
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>(cachedData?.lawsuits || []);
  const [movements, setMovements] = useState<Movement[]>(cachedData?.movements || []);
  const [loading, setLoading] = useState(!cachedData); // Não mostra loading se tem cache
  const [searchTerm, setSearchTerm] = useState('');
  const [movementSearchTerm, setMovementSearchTerm] = useState('');
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [showAllResponsibles, setShowAllResponsibles] = useState(true);
  const [selectedMovementResponsibles, setSelectedMovementResponsibles] = useState<string[]>([]);
  const [showAllMovementResponsibles, setShowAllMovementResponsibles] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showAllStatuses, setShowAllStatuses] = useState(true);
  const [totalLawsuits, setTotalLawsuits] = useState<number | null>(cachedData?.totalLawsuits || null);
  const [totalMovements, setTotalMovements] = useState<number | null>(cachedData?.totalMovements || null);
  const [metadata, setMetadata] = useState<{ fromCache: boolean; rateLimited: boolean; cacheAge: number } | null>(cachedData?.metadata || null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(cachedData?.lastUpdate);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const { toast } = useToast();

  const openTaskDialog = (movement: Movement) => {
    setSelectedMovement(movement);
    setTaskDialogOpen(true);
  };

  const normalizeProcessNumber = (value?: string | null) =>
    (value || '').replace(/[^0-9]/g, '');

  const createTaskFromMovement = async () => {
    if (!selectedMovement) return;

    try {
      console.log('createTaskFromMovement - selectedMovement', selectedMovement);
      console.log('createTaskFromMovement - lawsuits length', lawsuits.length);

      // Tentar localizar o processo pelo ID ou pelo número (ignorando formatação)
      let lawsuit = lawsuits.find(
        (l) =>
          l.id === selectedMovement.lawsuit_id ||
          normalizeProcessNumber(l.process_number) ===
            normalizeProcessNumber(selectedMovement.process_number)
      );

      // Se não encontrar, tenta recarregar a lista de processos uma vez
      if (!lawsuit) {
        console.warn('Lawsuit not found locally, refetching from Advbox...');
        const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke(
          'advbox-integration/lawsuits'
        );

        if (!lawsuitsError && lawsuitsData) {
          const apiResponse = lawsuitsData?.data || lawsuitsData;
          const refreshed = apiResponse?.data || [];
          setLawsuits(refreshed);
          lawsuit = (refreshed as any[]).find(
            (l: any) =>
              l.id === selectedMovement.lawsuit_id ||
              normalizeProcessNumber(l.process_number) ===
                normalizeProcessNumber(selectedMovement.process_number)
          );
        } else {
          console.error('Error refetching lawsuits for task creation', lawsuitsError);
        }
      }

      if (!lawsuit) {
        toast({
          title: 'Processo não encontrado',
          description:
            'Não foi possível localizar o processo no Advbox para criar a tarefa. Tente novamente em alguns minutos.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar o usuário atual (mantido para futura expansão, se precisarmos vincular no banco interno)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Usuário não autenticado',
          description: 'Você precisa estar autenticado para criar tarefas.',
          variant: 'destructive',
        });
        return;
      }

      // Preparar dados no formato esperado pela API do Advbox
      const taskData = {
        lawsuits_id: selectedMovement.lawsuit_id || lawsuit.id,
        start_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        title: `Movimentação: ${selectedMovement.title}`,
        description: selectedMovement.header || selectedMovement.title,
        from: lawsuit.responsible_id, // ID do responsável pelo processo no Advbox
        tasks_id: 1, // ID padrão do tipo de tarefa (ajustar conforme necessário)
        guests: [lawsuit.responsible_id], // Atribuir ao responsável do processo
      };

      const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: taskData,
      });

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'Tarefa criada com sucesso a partir da movimentação.',
      });

      setTaskDialogOpen(false);
      setSelectedMovement(null);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description:
          error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    }
  };
  const getCustomerName = (customers: Lawsuit['customers'] | Movement['customers']): string => {
    if (!customers) return '';
    if (typeof customers === 'string') return customers;
    if (Array.isArray(customers)) {
      return customers.map((c) => c.name).join(', ');
    }
    return customers.name ?? '';
  };
  
  // Extrair lista única de responsáveis
  const responsibles = Array.from(new Set(lawsuits.map(l => l.responsible).filter(Boolean)));
  
  // Criar um mapa de lawsuit_id para responsável
  const lawsuitResponsibleMap = new Map<number, string>();
  lawsuits.forEach(lawsuit => {
    if (lawsuit.responsible) {
      lawsuitResponsibleMap.set(lawsuit.id, lawsuit.responsible);
    }
  });
  
  // Extrair lista única de responsáveis das movimentações
  const movementResponsibles = Array.from(new Set(
    movements
      .map(m => lawsuitResponsibleMap.get(m.lawsuit_id))
      .filter(Boolean) as string[]
  ));
  
  // Extrair lista única de status dos processos
  const lawsuitStatuses = Array.from(new Set(
    lawsuits.map(l => l.group).filter(Boolean)
  ));
  
  // Função para filtrar movimentações por período
  const getDateFilter = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'week':
        return subDays(now, 7);
      case 'month':
        return subMonths(now, 1);
      case 'quarter':
        return subMonths(now, 3);
      default:
        return null;
    }
  };
  
  // Filtrar processos
  const filteredLawsuits = lawsuits.filter(lawsuit => {
    const customerName = getCustomerName(lawsuit.customers as Lawsuit['customers']);

    const matchesSearch = !searchTerm || 
      lawsuit.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawsuit.responsible?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesResponsible = showAllResponsibles || 
      selectedResponsibles.includes(lawsuit.responsible);
    
    return matchesSearch && matchesResponsible;
  });
  
  // Filtrar movimentações
  const filteredMovements = movements.filter(movement => {
    const customerName = getCustomerName(movement.customers);
    const movementResponsible = lawsuitResponsibleMap.get(movement.lawsuit_id);
    const dateFilter = getDateFilter();
    
    // Encontrar o processo associado à movimentação para pegar seu status
    const associatedLawsuit = lawsuits.find(l => l.id === movement.lawsuit_id);
    const movementStatus = associatedLawsuit?.group;
    
    const matchesSearch = !movementSearchTerm ||
      movement.process_number.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      movement.title.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(movementSearchTerm.toLowerCase()) ||
      movement.header?.toLowerCase().includes(movementSearchTerm.toLowerCase());
    
    const matchesResponsible = showAllMovementResponsibles || 
      (movementResponsible && selectedMovementResponsibles.includes(movementResponsible));
    
    const matchesPeriod = !dateFilter || isAfter(new Date(movement.date), dateFilter);
    
    const matchesStatus = showAllStatuses || 
      (movementStatus && selectedStatuses.includes(movementStatus));
    
    return matchesSearch && matchesResponsible && matchesPeriod && matchesStatus;
  });
  
  // Preparar dados para o gráfico de timeline
  const getTimelineData = () => {
    const dateCounts: { [key: string]: number } = {};
    
    filteredMovements.forEach(movement => {
      const dateKey = format(new Date(movement.date), 'dd/MM', { locale: ptBR });
      dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
    });
    
    return Object.entries(dateCounts)
      .map(([date, count]) => ({ date, movimentações: count }))
      .slice(-30); // Últimos 30 dias
  };
  
  // Preparar dados para o gráfico de tipos de ação
  const getActionTypesData = () => {
    const typeCounts: { [key: string]: number } = {};
    
    filteredLawsuits.forEach(lawsuit => {
      const type = lawsuit.type || 'Não informado';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10); // Top 10 tipos
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (forceRefresh = false) => {
    try {
      const refreshParam = forceRefresh ? '?force_refresh=true' : '';
      
      const [lawsuitsRes, movementsRes] = await Promise.all([
        supabase.functions.invoke(`advbox-integration/lawsuits${refreshParam}`),
        supabase.functions.invoke(`advbox-integration/last-movements${refreshParam}`),
      ]);

      if (lawsuitsRes.error) throw lawsuitsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      // A resposta vem como: { data: [...], metadata: {...} }
      // para ambos endpoints (lawsuits e last-movements)
      const lawsuitsArray: Lawsuit[] = (lawsuitsRes.data as any)?.data || [];
      const movementsArray: Movement[] = (movementsRes.data as any)?.data || [];

      console.log('Lawsuits parsed:', lawsuitsArray.length, 'items');
      console.log('Movements parsed:', movementsArray.length, 'items');

      // Se a API retornar vazio mas já temos processos em memória,
      // mantemos o estado atual para evitar zerar a página
      if (lawsuitsArray.length === 0 && lawsuits.length > 0) {
        console.warn('API retornou 0 processos, mantendo lista atual em memória.');
      } else {
        setLawsuits(lawsuitsArray);
      }

      setMovements(movementsArray);
      const updateTime = new Date();
      setLastUpdate(updateTime);
      
      // Extrair metadata do nível raiz da resposta
      const rootMetadata = (lawsuitsRes.data as any)?.metadata;
      if (rootMetadata) {
        setMetadata(rootMetadata);
      }

      const lawsuitsTotal = lawsuitsArray.length;
      const movementsTotal = movementsArray.length;

      setTotalLawsuits(lawsuitsTotal);
      setTotalMovements(movementsTotal);

      // Atualizar cache apenas quando tivermos dados de processos
      try {
        if (lawsuitsArray.length > 0) {
          const cacheData = {
            lawsuits: lawsuitsArray,
            movements: movementsArray,
            totalLawsuits: lawsuitsTotal,
            totalMovements: movementsTotal,
            metadata: rootMetadata || null,
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, updateTime.toISOString());
        } else if (!cachedData?.lawsuits?.length && lawsuits.length === 0) {
          // Primeira vez sem dados nenhum: limpar cache para refletir estado vazio real
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        }
      } catch (cacheError) {
        console.error('Error saving to cache:', cacheError);
      }
    } catch (error) {
      console.error('Error fetching Advbox data:', error);
      
      // Se falhou e não tem cache, mostra erro
      if (!cachedData) {
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar os dados do Advbox.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando processos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Briefcase className="h-8 w-8 text-primary" />
                Dashboard de Processos
              </h1>
              <p className="text-muted-foreground mt-2">
                Acompanhe seus processos e movimentações em tempo real
              </p>
              <div className="mt-2">
                <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
              </div>
            </div>
            
          </div>
        </div>

        <AdvboxCacheAlert metadata={metadata} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Estatísticas */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Visão Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {searchTerm || !showAllResponsibles
                      ? filteredLawsuits.length
                      : (totalLawsuits ?? filteredLawsuits.length)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Processos {searchTerm || !showAllResponsibles ? 'Filtrados' : 'Ativos'}</div>
                </div>
                <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {movementSearchTerm
                      ? filteredMovements.length
                      : (totalMovements ?? filteredMovements.length)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Movimentações {movementSearchTerm ? 'Filtradas' : 'Recentes'}</div>
                </div>
                <div className="text-center p-4 bg-orange-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">
                    {filteredMovements.filter(m => {
                      const date = new Date(m.date);
                      const today = new Date();
                      const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays <= 7;
                    }).length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Alertas (Últimos 7 dias)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processos Ativos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle>Processos Ativos</CardTitle>
                  <CardDescription>Seus processos em andamento</CardDescription>
                </div>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar processos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <h4 className="font-medium">Filtrar por Responsável</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-responsibles"
                            checked={showAllResponsibles}
                            onCheckedChange={(checked) => {
                              setShowAllResponsibles(checked as boolean);
                              if (checked) setSelectedResponsibles([]);
                            }}
                          />
                          <label htmlFor="all-responsibles" className="text-sm font-medium cursor-pointer">
                            Todos os responsáveis
                          </label>
                        </div>
                        
                        <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                          {responsibles.map((responsible) => (
                            <div key={responsible} className="flex items-center space-x-2">
                              <Checkbox
                                id={responsible}
                                checked={selectedResponsibles.includes(responsible)}
                                disabled={showAllResponsibles}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedResponsibles([...selectedResponsibles, responsible]);
                                    setShowAllResponsibles(false);
                                  } else {
                                    setSelectedResponsibles(selectedResponsibles.filter(r => r !== responsible));
                                  }
                                }}
                              />
                              <label htmlFor={responsible} className="text-sm cursor-pointer">
                                {responsible}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        {!showAllResponsibles && selectedResponsibles.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedResponsibles([]);
                              setShowAllResponsibles(true);
                            }}
                            className="w-full"
                          >
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                   {filteredLawsuits.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchTerm || !showAllResponsibles ? 'Nenhum processo encontrado com os filtros aplicados' : 'Nenhum processo encontrado'}
                    </p>
                  ) : (
                    filteredLawsuits.map((lawsuit) => (
                      <Card key={lawsuit.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">{lawsuit.process_number}</p>
                                {lawsuit.customers && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Cliente: <span className="font-medium text-foreground">{getCustomerName(lawsuit.customers as Lawsuit['customers'])}</span>
                                  </p>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {lawsuit.type}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {lawsuit.group}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {lawsuit.responsible && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Responsável: </span>
                                <span className="font-medium">{lawsuit.responsible}</span>
                              </div>
                            )}
                            
                            {lawsuit.folder && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Pasta: </span>
                                <span>{lawsuit.folder}</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                              {lawsuit.created_at && (
                                <div>
                                  <span className="text-muted-foreground">Criado: </span>
                                  <span>{new Date(lawsuit.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.status_closure && (
                                <div>
                                  <span className="text-muted-foreground">Encerrado: </span>
                                  <span>{new Date(lawsuit.status_closure).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.exit_production && (
                                <div>
                                  <span className="text-muted-foreground">Saída produção: </span>
                                  <span>{new Date(lawsuit.exit_production).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              {lawsuit.process_date && (
                                <div>
                                  <span className="text-muted-foreground">Data processo: </span>
                                  <span>{new Date(lawsuit.process_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                            </div>
                            
                            {(lawsuit.fees_expec || lawsuit.fees_money || lawsuit.contingency) && (
                              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                                {lawsuit.fees_expec && (
                                  <div>
                                    <span className="text-muted-foreground">Honorários Esperados: </span>
                                    <span className="font-medium">
                                      {lawsuit.fees_expec.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                                {lawsuit.fees_money && (
                                  <div>
                                    <span className="text-muted-foreground">Honorários: </span>
                                    <span className="font-medium">
                                      {lawsuit.fees_money.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                                {lawsuit.contingency && (
                                  <div>
                                    <span className="text-muted-foreground">Contingência: </span>
                                    <span className="font-medium">
                                      {lawsuit.contingency.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Gráficos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Tipos de Ação Mais Frequentes
              </CardTitle>
              <CardDescription>Top 10 tipos de processos</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={getActionTypesData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    type="category"
                    dataKey="tipo" 
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    width={150}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="quantidade" 
                    fill="hsl(var(--accent))"
                    radius={[0, 8, 8, 0]}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {filteredMovements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Timeline de Movimentações
                </CardTitle>
                <CardDescription>Distribuição ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={getTimelineData()}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="movimentações" 
                      fill="hsl(var(--primary))"
                      radius={[8, 8, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Movimentações Recentes */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Movimentações Recentes
                  </CardTitle>
                  <CardDescription>Últimas atualizações dos processos</CardDescription>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar movimentações..."
                      value={movementSearchTerm}
                      onChange={(e) => setMovementSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="quarter">Últimos 3 meses</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Status
                        {!showAllStatuses && selectedStatuses.length > 0 && (
                          <Badge variant="secondary" className="ml-1">{selectedStatuses.length}</Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Filtrar por Status</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-statuses"
                            checked={showAllStatuses}
                            onCheckedChange={(checked) => {
                              setShowAllStatuses(!!checked);
                              if (checked) {
                                setSelectedStatuses([]);
                              }
                            }}
                          />
                          <label htmlFor="all-statuses" className="text-sm font-medium cursor-pointer">
                            Todos os Status
                          </label>
                        </div>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {lawsuitStatuses.map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                              <Checkbox
                                id={`status-${status}`}
                                checked={selectedStatuses.includes(status)}
                                disabled={showAllStatuses}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedStatuses([...selectedStatuses, status]);
                                    setShowAllStatuses(false);
                                  } else {
                                    setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                                  }
                                }}
                              />
                              <label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                                {status}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        {!showAllStatuses && selectedStatuses.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedStatuses([]);
                              setShowAllStatuses(true);
                            }}
                            className="w-full"
                          >
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Responsável
                        {!showAllMovementResponsibles && selectedMovementResponsibles.length > 0 && (
                          <Badge variant="secondary" className="ml-1">{selectedMovementResponsibles.length}</Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Filtrar por Responsável</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-movement-responsibles"
                            checked={showAllMovementResponsibles}
                            onCheckedChange={(checked) => {
                              setShowAllMovementResponsibles(!!checked);
                              if (checked) {
                                setSelectedMovementResponsibles([]);
                              }
                            }}
                          />
                          <label htmlFor="all-movement-responsibles" className="text-sm font-medium cursor-pointer">
                            Todos os Responsáveis
                          </label>
                        </div>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {movementResponsibles.map((responsible) => (
                            <div key={responsible} className="flex items-center space-x-2">
                              <Checkbox
                                id={`movement-${responsible}`}
                                checked={selectedMovementResponsibles.includes(responsible)}
                                disabled={showAllMovementResponsibles}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedMovementResponsibles([...selectedMovementResponsibles, responsible]);
                                    setShowAllMovementResponsibles(false);
                                  } else {
                                    setSelectedMovementResponsibles(selectedMovementResponsibles.filter(r => r !== responsible));
                                  }
                                }}
                              />
                              <label htmlFor={`movement-${responsible}`} className="text-sm cursor-pointer">
                                {responsible}
                              </label>
                            </div>
                          ))}
                        </div>
                        
                        {!showAllMovementResponsibles && selectedMovementResponsibles.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedMovementResponsibles([]);
                              setShowAllMovementResponsibles(true);
                            }}
                            className="w-full"
                          >
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {movementSearchTerm || !showAllMovementResponsibles ? 'Nenhuma movimentação encontrada com os filtros aplicados' : 'Nenhuma movimentação encontrada'}
                    </p>
                  ) : (
                    filteredMovements.map((movement, index) => (
                      <div key={`${movement.lawsuit_id}-${index}`} className="border-l-2 border-primary/30 pl-3 pb-4 mb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {new Date(movement.date).toLocaleDateString('pt-BR')}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTaskDialog(movement)}
                          >
                            <ListTodo className="h-4 w-4 mr-1" />
                            Criar Tarefa
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-primary mb-1">
                              {movement.process_number}
                            </p>
                            {movement.customers && (
                              <p className="text-xs text-muted-foreground">
                                Cliente: {getCustomerName(movement.customers)}
                              </p>
                            )}
                          </div>
                          
                          <div className="bg-muted/30 p-2 rounded">
                            <p className="text-xs font-medium mb-1">{movement.title}</p>
                            {movement.header && (
                              <p className="text-xs text-muted-foreground">{movement.header}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Dialog de Criação de Tarefa */}
        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Tarefa a partir da Movimentação</DialogTitle>
              <DialogDescription>
                Confirme para criar uma tarefa baseada nesta movimentação
              </DialogDescription>
            </DialogHeader>
            {selectedMovement && (
              <div className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-md text-sm space-y-2">
                  <p>
                    <span className="font-medium">Data:</span>{' '}
                    {format(new Date(selectedMovement.date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p>
                    <span className="font-medium">Processo:</span> {selectedMovement.process_number}
                  </p>
                  <p>
                    <span className="font-medium">Título:</span> {selectedMovement.title}
                  </p>
                  {selectedMovement.header && (
                    <p>
                      <span className="font-medium">Detalhes:</span> {selectedMovement.header}
                    </p>
                  )}
                  {selectedMovement.customers && (
                    <p>
                      <span className="font-medium">Cliente(s):</span>{' '}
                      {getCustomerName(selectedMovement.customers)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={createTaskFromMovement} className="flex-1">
                    Criar Tarefa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTaskDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
