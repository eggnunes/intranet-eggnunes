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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Briefcase, TrendingUp, BarChart, Search, Filter, AlertCircle, Calendar, ListTodo } from 'lucide-react';

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
  const [evolutionPeriod, setEvolutionPeriod] = useState<string>('all'); // dias: 7, 30, 90, all - padrão "all" para mostrar dados
  const [totalLawsuits, setTotalLawsuits] = useState<number | null>(cachedData?.totalLawsuits || null);
  const [totalMovements, setTotalMovements] = useState<number | null>(cachedData?.totalMovements || null);
  const [metadata, setMetadata] = useState<{ fromCache: boolean; rateLimited: boolean; cacheAge: number } | null>(cachedData?.metadata || null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(cachedData?.lastUpdate);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  
  // Filtros para gráficos de evolução
  const [selectedEvolutionTypes, setSelectedEvolutionTypes] = useState<string[]>([]);
  const [showAllEvolutionTypes, setShowAllEvolutionTypes] = useState(true);
  const [selectedEvolutionAreas, setSelectedEvolutionAreas] = useState<string[]>([]);
  const [showAllEvolutionAreas, setShowAllEvolutionAreas] = useState(true);
  
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
  
  // Extrair lista única de tipos de ação
  const actionTypes = Array.from(new Set(
    lawsuits.map(l => l.type).filter(Boolean)
  ));
  
  // Extrair lista única de áreas de atuação
  const areaOptions = Array.from(new Set(
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

  // Helpers para calcular datas de criação e arquivamento
  const getCreatedOrProcessDate = (lawsuit: Lawsuit): Date | null => {
    if (lawsuit.created_at) {
      const created = new Date(lawsuit.created_at);
      if (!isNaN(created.getTime())) return created;
    }

    if (lawsuit.process_date) {
      const process = new Date(lawsuit.process_date);
      if (!isNaN(process.getTime())) return process;
    }

    return null;
  };

  const getArchiveDate = (lawsuit: Lawsuit): Date | null => {
    const dates: Date[] = [];

    if (lawsuit.status_closure) {
      const d = new Date(lawsuit.status_closure);
      if (!isNaN(d.getTime())) dates.push(d);
    }

    if (lawsuit.exit_production) {
      const d = new Date(lawsuit.exit_production);
      if (!isNaN(d.getTime())) dates.push(d);
    }

    if (lawsuit.exit_execution) {
      const d = new Date(lawsuit.exit_execution);
      if (!isNaN(d.getTime())) dates.push(d);
    }

    if (!dates.length) return null;

    return dates.reduce((latest, current) => (current > latest ? current : latest), dates[0]);
  };

  // Preparar dados para gráfico de evolução temporal (últimos 12 meses)
  const getEvolutionTimelineData = () => {
    // Filtrar lawsuits por tipo e área se filtros estiverem ativos
    let filteredForTimeline = lawsuits;

    if (!showAllEvolutionTypes && selectedEvolutionTypes.length > 0) {
      filteredForTimeline = filteredForTimeline.filter(
        (lawsuit) => lawsuit.type && selectedEvolutionTypes.includes(lawsuit.type),
      );
    }

    if (!showAllEvolutionAreas && selectedEvolutionAreas.length > 0) {
      filteredForTimeline = filteredForTimeline.filter(
        (lawsuit) => lawsuit.group && selectedEvolutionAreas.includes(lawsuit.group),
      );
    }

    const monthsData: { [key: string]: { novos: number; arquivados: number } } = {};

    // Criar últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM/yy', { locale: ptBR });
      monthsData[monthKey] = { novos: 0, arquivados: 0 };
    }

    // Contar processos novos por mês
    filteredForTimeline.forEach((lawsuit) => {
      const createdDate = getCreatedOrProcessDate(lawsuit);
      if (createdDate) {
        const monthKey = format(createdDate, 'MMM/yy', { locale: ptBR });
        if (monthsData[monthKey]) {
          monthsData[monthKey].novos++;
        }
      }
    });

    // Contar processos arquivados por mês
    filteredForTimeline.forEach((lawsuit) => {
      const archiveDate = getArchiveDate(lawsuit);
      if (archiveDate) {
        const monthKey = format(archiveDate, 'MMM/yy', { locale: ptBR });
        if (monthsData[monthKey]) {
          monthsData[monthKey].arquivados++;
        }
      }
    });

    return Object.entries(monthsData).map(([mês, data]) => ({
      mês,
      novos: data.novos,
      arquivados: data.arquivados,
    }));
  };

  // Dados para gráfico de taxa de crescimento mensal percentual
  const getMonthlyGrowthRateData = () => {
    const timeline = getEvolutionTimelineData();
    let cumulativeActive = 0;

    return timeline.map((item, index) => {
      const novos = item.novos ?? 0;
      const arquivados = item.arquivados ?? 0;
      const net = novos - arquivados;
      const previousActive = cumulativeActive;
      cumulativeActive += net;

      let growthPercent: number | null = null;
      if (index > 0 && previousActive > 0) {
        growthPercent = (net / previousActive) * 100;
        growthPercent = Math.round(growthPercent * 10) / 10;
      }

      return {
        ...item,
        crescimentoPercentual: growthPercent,
      };
    });
  };
  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

  // Calcular processos novos e arquivados no período selecionado
  const getEvolutionMetrics = () => {
    const now = new Date();
    let startDate: Date | null = null;

    switch (evolutionPeriod) {
      case '7':
        startDate = subDays(now, 7);
        break;
      case '30':
        startDate = subDays(now, 30);
        break;
      case '90':
        startDate = subDays(now, 90);
        break;
      default:
        startDate = null; // todos os períodos
    }

    // Filtrar lawsuits por tipo e área se filtros estiverem ativos
    let filteredForEvolution = lawsuits;

    if (!showAllEvolutionTypes && selectedEvolutionTypes.length > 0) {
      filteredForEvolution = filteredForEvolution.filter(
        (lawsuit) => lawsuit.type && selectedEvolutionTypes.includes(lawsuit.type),
      );
    }

    if (!showAllEvolutionAreas && selectedEvolutionAreas.length > 0) {
      filteredForEvolution = filteredForEvolution.filter(
        (lawsuit) => lawsuit.group && selectedEvolutionAreas.includes(lawsuit.group),
      );
    }

    // Contar processos novos usando data de criação ou data do processo
    // Também considerar processos que não têm status_closure/exit_production/exit_execution como "novos" dentro do período
    const newProcesses = filteredForEvolution.filter((lawsuit) => {
      const createdDate = getCreatedOrProcessDate(lawsuit);
      if (!createdDate) return false;
      
      // Se não tem startDate (todos os períodos), contar tudo com data válida
      if (!startDate) return true;
      
      return isAfter(createdDate, startDate);
    }).length;

    // Contar processos arquivados usando a melhor data disponível de arquivamento/saída
    const archivedProcesses = filteredForEvolution.filter((lawsuit) => {
      const archiveDate = getArchiveDate(lawsuit);
      if (!archiveDate) return false;
      
      if (!startDate) return true;
      
      return isAfter(archiveDate, startDate);
    }).length;

    // Quebra por área (group)
    const newByArea: { [key: string]: number } = {};
    filteredForEvolution.forEach((lawsuit) => {
      const createdDate = getCreatedOrProcessDate(lawsuit);
      if (!createdDate) return;
      if (!startDate || isAfter(createdDate, startDate)) {
        const area = lawsuit.group || 'Não informado';
        newByArea[area] = (newByArea[area] || 0) + 1;
      }
    });

    return {
      newProcesses,
      archivedProcesses,
      newByArea: Object.entries(newByArea)
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count),
    };
  };
  const evolutionMetrics = getEvolutionMetrics();
  const netGrowth = evolutionMetrics.newProcesses - evolutionMetrics.archivedProcesses;

  // Calcular processos ativos por tipo de ação (type)
  const getActiveByTypeData = () => {
    const typeCounts: { [key: string]: number } = {};
    
    filteredLawsuits.forEach(lawsuit => {
      const type = lawsuit.type || 'Não informado';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  // Evolução por tipo de ação (últimos 6 meses)
  const getTypeEvolutionData = () => {
    const monthsData: { [key: string]: { [type: string]: number } } = {};
    
    // Criar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM/yy', { locale: ptBR });
      monthsData[monthKey] = {};
    }

    // Pegar top 5 tipos mais frequentes
    const topTypes = getActiveByTypeData().slice(0, 5).map(t => t.tipo);

    // Contar processos novos por mês e tipo
    lawsuits.forEach(lawsuit => {
      if (lawsuit.created_at && topTypes.includes(lawsuit.type)) {
        const createdDate = new Date(lawsuit.created_at);
        const monthKey = format(createdDate, 'MMM/yy', { locale: ptBR });
        if (monthsData[monthKey]) {
          const type = lawsuit.type;
          monthsData[monthKey][type] = (monthsData[monthKey][type] || 0) + 1;
        }
      }
    });

    return {
      data: Object.entries(monthsData).map(([mês, types]) => ({
        mês,
        ...types
      })),
      types: topTypes
    };
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

      // A resposta pode vir como:
      // 1) { data: [...], metadata: {...}, totalCount?: number }
      // 2) [...]
      const rawLawsuits = lawsuitsRes.data as any;
      const rawMovements = movementsRes.data as any;

      const lawsuitsPayload = Array.isArray(rawLawsuits)
        ? { data: rawLawsuits }
        : (rawLawsuits || {});

      const movementsPayload = Array.isArray(rawMovements)
        ? { data: rawMovements }
        : (rawMovements || {});

      const lawsuitsArray: Lawsuit[] = (lawsuitsPayload.data as Lawsuit[]) || [];
      const movementsArray: Movement[] = (movementsPayload.data as Movement[]) || [];

      console.log('Lawsuits parsed:', lawsuitsArray.length, 'items');
      console.log('Movements parsed:', movementsArray.length, 'items');

      // Definir qual lista realmente será usada na tela:
      // - Se a API voltou vazia mas já temos processos em memória (cache do navegador),
      //   continuamos usando a lista em memória para não zerar a página.
      const finalLawsuits: Lawsuit[] =
        lawsuitsArray.length === 0 && lawsuits.length > 0 ? lawsuits : lawsuitsArray;

      const finalMovements: Movement[] = movementsArray;

      setLawsuits(finalLawsuits);
      setMovements(finalMovements);

      const updateTime = new Date();
      setLastUpdate(updateTime);
      
      // Extrair metadata do nível raiz da resposta, se existir
      const rootMetadata = !Array.isArray(rawLawsuits) ? rawLawsuits?.metadata : undefined;
      if (rootMetadata) {
        setMetadata(rootMetadata);
      }

      const lawsuitsTotalFromApi =
        typeof (rawLawsuits as any)?.totalCount === 'number'
          ? (rawLawsuits as any).totalCount
          : typeof (lawsuitsPayload as any)?.totalCount === 'number'
          ? (lawsuitsPayload as any).totalCount
          : undefined;

      const movementsTotalFromApi =
        typeof (rawMovements as any)?.totalCount === 'number'
          ? (rawMovements as any).totalCount
          : typeof (movementsPayload as any)?.totalCount === 'number'
          ? (movementsPayload as any).totalCount
          : undefined;

      const lawsuitsTotal = lawsuitsTotalFromApi ?? finalLawsuits.length;
      const movementsTotal = movementsTotalFromApi ?? finalMovements.length;

      setTotalLawsuits(lawsuitsTotal);
      setTotalMovements(movementsTotal);

      // Atualizar cache apenas quando tivermos dados de processos
      try {
        if (finalLawsuits.length > 0) {
          const cacheData = {
            lawsuits: finalLawsuits,
            movements: finalMovements,
            totalLawsuits: lawsuitsTotal,
            totalMovements: movementsTotal,
            metadata: rootMetadata || null,
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, updateTime.toISOString());
        } else if (!cachedData?.lawsuits?.length && finalLawsuits.length === 0) {
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Visão Geral
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Período de Evolução:</span>
                <Select value={evolutionPeriod} onValueChange={setEvolutionPeriod}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todos os períodos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                <div className="text-center p-4 bg-green-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {evolutionMetrics.newProcesses}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Processos Novos
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {evolutionPeriod === 'all' ? 'Total' : `Últimos ${evolutionPeriod} dias`}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {evolutionMetrics.archivedProcesses}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Processos Arquivados
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {evolutionPeriod === 'all' ? 'Total' : `Últimos ${evolutionPeriod} dias`}
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg ${netGrowth >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                  <div className={`text-3xl font-bold ${netGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'} flex items-center justify-center gap-1`}>
                    {netGrowth >= 0 ? '+' : ''}{netGrowth}
                    {netGrowth >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingUp className="h-5 w-5 rotate-180" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Crescimento Líquido
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {evolutionPeriod === 'all' ? 'Total' : `Últimos ${evolutionPeriod} dias`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seções Expansíveis */}
          <div className="lg:col-span-3">
            <Accordion type="multiple" className="space-y-4">
              
              {/* Evolução Temporal */}
              <AccordionItem value="evolucao" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="font-semibold">Evolução de Processos (Últimos 12 Meses)</span>
                    {(!showAllEvolutionTypes || !showAllEvolutionAreas) && (
                      <Badge variant="secondary" className="ml-2">
                        Filtrado
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Tipo de Ação
                            {!showAllEvolutionTypes && selectedEvolutionTypes.length > 0 && (
                              <Badge variant="secondary" className="ml-1">{selectedEvolutionTypes.length}</Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="start">
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm">Filtrar por Tipo de Ação</h4>
                            
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="all-evolution-types"
                                checked={showAllEvolutionTypes}
                                onCheckedChange={(checked) => {
                                  setShowAllEvolutionTypes(!!checked);
                                  if (checked) {
                                    setSelectedEvolutionTypes([]);
                                  }
                                }}
                              />
                              <label htmlFor="all-evolution-types" className="text-sm font-medium cursor-pointer">
                                Todos os Tipos
                              </label>
                            </div>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {actionTypes.map((type) => (
                                <div key={type} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`evolution-type-${type}`}
                                    checked={selectedEvolutionTypes.includes(type)}
                                    disabled={showAllEvolutionTypes}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedEvolutionTypes([...selectedEvolutionTypes, type]);
                                        setShowAllEvolutionTypes(false);
                                      } else {
                                        setSelectedEvolutionTypes(selectedEvolutionTypes.filter(t => t !== type));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`evolution-type-${type}`} className="text-sm cursor-pointer">
                                    {type}
                                  </label>
                                </div>
                              ))}
                            </div>
                            
                            {!showAllEvolutionTypes && selectedEvolutionTypes.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedEvolutionTypes([]);
                                  setShowAllEvolutionTypes(true);
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
                            Área de Atuação
                            {!showAllEvolutionAreas && selectedEvolutionAreas.length > 0 && (
                              <Badge variant="secondary" className="ml-1">{selectedEvolutionAreas.length}</Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="start">
                          <div className="space-y-4">
                            <h4 className="font-medium text-sm">Filtrar por Área de Atuação</h4>
                            
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="all-evolution-areas"
                                checked={showAllEvolutionAreas}
                                onCheckedChange={(checked) => {
                                  setShowAllEvolutionAreas(!!checked);
                                  if (checked) {
                                    setSelectedEvolutionAreas([]);
                                  }
                                }}
                              />
                              <label htmlFor="all-evolution-areas" className="text-sm font-medium cursor-pointer">
                                Todas as Áreas
                              </label>
                            </div>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {areaOptions.map((area) => (
                                <div key={area} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`evolution-area-${area}`}
                                    checked={selectedEvolutionAreas.includes(area)}
                                    disabled={showAllEvolutionAreas}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedEvolutionAreas([...selectedEvolutionAreas, area]);
                                        setShowAllEvolutionAreas(false);
                                      } else {
                                        setSelectedEvolutionAreas(selectedEvolutionAreas.filter(a => a !== area));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`evolution-area-${area}`} className="text-sm cursor-pointer">
                                    {area}
                                  </label>
                                </div>
                              ))}
                            </div>
                            
                            {!showAllEvolutionAreas && selectedEvolutionAreas.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedEvolutionAreas([]);
                                  setShowAllEvolutionAreas(true);
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
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={getEvolutionTimelineData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mês" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="novos" stroke="#10b981" name="Processos Novos" strokeWidth={2} />
                        <Line type="monotone" dataKey="arquivados" stroke="#8b5cf6" name="Processos Arquivados" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Taxa de Crescimento Mensal */}
              <AccordionItem value="taxa-crescimento" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="font-semibold">Taxa de Crescimento Mensal (%)</span>
                    <span className="text-sm text-muted-foreground ml-2">(Últimos 12 meses)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={getMonthlyGrowthRateData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mês" />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip
                          formatter={(value) =>
                            value != null
                              ? [`${(value as number).toFixed(1)}%`, 'Crescimento']
                              : ['Sem dados', 'Crescimento']
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="crescimentoPercentual"
                          name="Crescimento %"
                          stroke="hsl(var(--accent))"
                          strokeWidth={2}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Processos Novos por Área */}
              <AccordionItem value="novos-area" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    <span className="font-semibold">Processos Novos por Área</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({evolutionPeriod === 'all' ? 'Total geral' : `Últimos ${evolutionPeriod} dias`})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    {evolutionMetrics.newByArea.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={evolutionMetrics.newByArea}
                            dataKey="count"
                            nameKey="area"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry) => `${entry.area}: ${entry.count}`}
                          >
                            {evolutionMetrics.newByArea.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        Nenhum processo novo no período selecionado
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Processos Ativos por Tipo de Ação */}
              <AccordionItem value="ativos-tipo" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    <span className="font-semibold">Processos Ativos por Tipo de Ação</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({filteredLawsuits.length} processos)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <RechartsBarChart data={getActiveByTypeData()} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          type="number"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          type="category"
                          dataKey="tipo" 
                          tick={{ fontSize: 11 }}
                          className="text-muted-foreground"
                          width={200}
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
                          fill="#10b981"
                          radius={[0, 8, 8, 0]}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Crescimento por Tipo de Ação */}
              <AccordionItem value="crescimento-tipo" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="font-semibold">Evolução por Tipo de Ação (Top 5)</span>
                    <span className="text-sm text-muted-foreground ml-2">(Últimos 6 meses)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={getTypeEvolutionData().data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mês" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {getTypeEvolutionData().types.map((type, index) => (
                          <Line 
                            key={type}
                            type="monotone" 
                            dataKey={type} 
                            stroke={COLORS[index % COLORS.length]} 
                            name={type}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Tipos de Ação Mais Frequentes */}
              <AccordionItem value="tipos-frequentes" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    <span className="font-semibold">Tipos de Ação Mais Frequentes</span>
                    <span className="text-sm text-muted-foreground ml-2">(Top 10)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4">
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
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Timeline de Movimentações */}
              {filteredMovements.length > 0 && (
                <AccordionItem value="timeline" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <BarChart className="h-5 w-5" />
                      <span className="font-semibold">Timeline de Movimentações</span>
                      <span className="text-sm text-muted-foreground ml-2">(Últimos 30 dias)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4">
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Processos Ativos - Lista */}
              <AccordionItem value="processos-lista" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    <span className="font-semibold">Processos Ativos</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({filteredLawsuits.length} {searchTerm || !showAllResponsibles ? 'filtrados' : 'total'})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4 space-y-3">
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
                                id="all-process-responsibles"
                                checked={showAllResponsibles}
                                onCheckedChange={(checked) => {
                                  setShowAllResponsibles(checked as boolean);
                                  if (checked) setSelectedResponsibles([]);
                                }}
                              />
                              <label htmlFor="all-process-responsibles" className="text-sm font-medium cursor-pointer">
                                Todos os responsáveis
                              </label>
                            </div>
                            
                            <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
                              {responsibles.map((responsible) => (
                                <div key={responsible} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`process-${responsible}`}
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
                                  <label htmlFor={`process-${responsible}`} className="text-sm cursor-pointer">
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
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Movimentações Recentes */}
              <AccordionItem value="movimentacoes" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Movimentações Recentes</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({filteredMovements.length})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-4 space-y-3">
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
                        <PopoverContent className="w-80">
                          <div className="space-y-4">
                            <h4 className="font-medium">Filtrar por Responsável</h4>
                            
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="all-movement-responsibles"
                                checked={showAllMovementResponsibles}
                                onCheckedChange={(checked) => {
                                  setShowAllMovementResponsibles(checked as boolean);
                                  if (checked) setSelectedMovementResponsibles([]);
                                }}
                              />
                              <label htmlFor="all-movement-responsibles" className="text-sm font-medium cursor-pointer">
                                Todos os responsáveis
                              </label>
                            </div>
                            
                            <div className="border-t pt-2 space-y-2 max-h-60 overflow-y-auto">
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
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>
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
