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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { TaskCreationDialog } from '@/components/TaskCreationDialog';
import { TaskSuggestionsPanel } from '@/components/TaskSuggestionsPanel';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, subMonths, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Briefcase, TrendingUp, BarChart, Search, Filter, AlertCircle, Calendar, ListTodo, RefreshCw, MessageSquare, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  const MOVEMENTS_CACHE_KEY = 'advbox-movements-full-cache';
  const MOVEMENTS_CACHE_TIMESTAMP_KEY = 'advbox-movements-full-cache-timestamp';
  
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
  
  // Carregar movimentações completas do cache
  const loadMovementsFromCache = () => {
    try {
      const cached = localStorage.getItem(MOVEMENTS_CACHE_KEY);
      const timestamp = localStorage.getItem(MOVEMENTS_CACHE_TIMESTAMP_KEY);
      if (cached && timestamp) {
        const data = JSON.parse(cached);
        console.log(`[Movements Cache] Loaded ${data.length} movements from cache`);
        return data;
      }
    } catch (error) {
      console.error('Error loading movements from cache:', error);
    }
    return null;
  };

  const cachedData = loadFromCache();
  const cachedMovements = loadMovementsFromCache();
  
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>(cachedData?.lawsuits || []);
  const [movements, setMovements] = useState<Movement[]>(cachedMovements || cachedData?.movements || []);
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
  const [evolutionPeriod, setEvolutionPeriod] = useState<string>('30'); // dias: 7, 30, 90, all - padrão "30 dias"
  const [totalLawsuits, setTotalLawsuits] = useState<number | null>(cachedData?.totalLawsuits || null);
  const [totalMovements, setTotalMovements] = useState<number | null>(cachedMovements?.length || cachedData?.totalMovements || null);
  const [metadata, setMetadata] = useState<{ fromCache: boolean; rateLimited: boolean; cacheAge: number } | null>(cachedData?.metadata || null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(cachedData?.lastUpdate);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [isLoadingFullData, setIsLoadingFullData] = useState(false);
  const [hasCompleteData, setHasCompleteData] = useState(cachedData?.isComplete || false);
  const [sendingDocRequest, setSendingDocRequest] = useState<number | null>(null);
  const [messageDialogLawsuit, setMessageDialogLawsuit] = useState<Lawsuit | null>(null);
  const [selectedMessageType, setSelectedMessageType] = useState<string>('');
  
  // Filtros para gráficos de evolução
  const [selectedEvolutionTypes, setSelectedEvolutionTypes] = useState<string[]>([]);
  const [showAllEvolutionTypes, setShowAllEvolutionTypes] = useState(true);
  const [selectedEvolutionAreas, setSelectedEvolutionAreas] = useState<string[]>([]);
  const [showAllEvolutionAreas, setShowAllEvolutionAreas] = useState(true);
  
  const { toast } = useToast();

  // Função para enviar cobrança de documentos via ChatGuru
  const sendDocumentRequest = async (lawsuit: Lawsuit) => {
    // Extrair dados do cliente
    let customerName = '';
    let customerPhone = '';
    let customerId = '';

    if (lawsuit.customers) {
      if (typeof lawsuit.customers === 'string') {
        customerName = lawsuit.customers;
      } else if (Array.isArray(lawsuit.customers) && lawsuit.customers.length > 0) {
        const firstCustomer = lawsuit.customers[0];
        customerName = firstCustomer.name || '';
        customerId = firstCustomer.customer_id?.toString() || '';
      } else if (typeof lawsuit.customers === 'object') {
        const customer = lawsuit.customers as { name: string; customer_id?: number };
        customerName = customer.name || '';
        customerId = customer.customer_id?.toString() || '';
      }
    }

    // Buscar telefone do cliente via Advbox API
    try {
      setSendingDocRequest(lawsuit.id);

      // Primeiro, buscar os dados do cliente para obter o telefone
      const { data: customerData, error: customerError } = await supabase.functions.invoke(
        'advbox-integration/customers',
        { body: { force_refresh: false } }
      );

      if (customerError) {
        throw new Error('Erro ao buscar dados do cliente');
      }

      // Encontrar o cliente nos dados
      let customers: any[] = [];
      if (Array.isArray(customerData)) {
        customers = customerData;
      } else if (customerData?.data?.data) {
        customers = customerData.data.data;
      } else if (customerData?.data) {
        customers = customerData.data;
      }

      // Procurar pelo cliente do processo
      const customerInfo = customers.find((c: any) => {
        if (customerId && c.id?.toString() === customerId) return true;
        if (customerName && c.name?.toLowerCase() === customerName.toLowerCase()) return true;
        return false;
      });

      if (!customerInfo) {
        throw new Error(`Cliente não encontrado: ${customerName || customerId}`);
      }

      customerPhone = customerInfo.cellphone || customerInfo.phone || '';
      
      if (!customerPhone) {
        throw new Error('Cliente não possui telefone cadastrado');
      }

      // Enviar mensagem de cobrança de documentos
      const { data: response, error } = await supabase.functions.invoke('send-document-request', {
        body: {
          customerId: customerInfo.id?.toString() || customerId,
          customerName: customerInfo.name || customerName,
          customerPhone,
          processNumber: lawsuit.process_number,
          processId: lawsuit.id,
        },
      });

      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Erro ao enviar mensagem');

      toast({
        title: 'Mensagem enviada',
        description: `Cobrança de documentos enviada para ${customerInfo.name}`,
      });
    } catch (error: any) {
      console.error('Erro ao enviar cobrança de documentos:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível enviar a cobrança de documentos',
        variant: 'destructive',
      });
    } finally {
      setSendingDocRequest(null);
    }
  };

  // Abrir diálogo de seleção de mensagem
  const openMessageDialog = (lawsuit: Lawsuit) => {
    setMessageDialogLawsuit(lawsuit);
    setSelectedMessageType('');
  };

  // Fechar diálogo de mensagem
  const closeMessageDialog = () => {
    setMessageDialogLawsuit(null);
    setSelectedMessageType('');
  };

  // Enviar mensagem baseada no tipo selecionado
  const handleSendMessage = async () => {
    if (!messageDialogLawsuit || !selectedMessageType) return;

    if (selectedMessageType === 'cobranca_documentos') {
      await sendDocumentRequest(messageDialogLawsuit);
    }
    // Adicionar outros tipos de mensagem aqui no futuro

    closeMessageDialog();
  };

  const openTaskDialog = (movement: Movement) => {
    setSelectedMovement(movement);
    setTaskDialogOpen(true);
  };
  
  const openTaskDialogFromLawsuit = (lawsuit: Lawsuit) => {
    // Criar um "movement" virtual a partir do lawsuit
    const virtualMovement: Movement = {
      lawsuit_id: lawsuit.id,
      date: lawsuit.created_at || new Date().toISOString(),
      title: `Tarefa para processo ${lawsuit.process_number}`,
      header: `Acompanhamento do processo ${lawsuit.process_number}`,
      process_number: lawsuit.process_number,
      protocol_number: lawsuit.protocol_number,
      customers: lawsuit.customers || '',
    };
    setSelectedMovement(virtualMovement);
    setTaskDialogOpen(true);
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
        return startOfDay(subDays(now, 7));
      case 'month':
        return startOfDay(subMonths(now, 1));
      case 'quarter':
        return startOfDay(subMonths(now, 3));
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
    
    const matchesPeriod = !dateFilter || !isBefore(new Date(movement.date), dateFilter);
    
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
  // IMPORTANTE: process_date é a data real do processo, created_at é a data do registro no sistema
  const getCreatedOrProcessDate = (lawsuit: Lawsuit): Date | null => {
    // Priorizar process_date que é a data real de distribuição/criação do processo
    if (lawsuit.process_date) {
      const process = new Date(lawsuit.process_date);
      if (!isNaN(process.getTime())) return process;
    }

    // Fallback para created_at apenas se process_date não estiver disponível
    if (lawsuit.created_at) {
      const created = new Date(lawsuit.created_at);
      if (!isNaN(created.getTime())) return created;
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
        startDate = startOfDay(subDays(now, 7));
        break;
      case '30':
        startDate = startOfDay(subDays(now, 30));
        break;
      case '90':
        startDate = startOfDay(subDays(now, 90));
        break;
      default:
        startDate = null; // todos os períodos
    }

    // Debug: Log para identificar problemas de data (apenas uma vez por período)
    if (startDate && lawsuits.length > 0) {
      // Encontrar as 10 datas mais recentes usando process_date (data real do processo)
      const recentDates = lawsuits
        .map(l => ({ 
          id: l.id, 
          date: getCreatedOrProcessDate(l), 
          process_date: l.process_date,
          created_at: l.created_at 
        }))
        .filter(l => l.date !== null)
        .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
        .slice(0, 10);
      
      console.log('[Debug] Period:', evolutionPeriod, 'days, Start date:', startDate.toISOString());
      console.log('[Debug] Total lawsuits:', lawsuits.length);
      console.log('[Debug] 10 most recent process_date (data real):', recentDates.map(l => ({
        id: l.id,
        process_date: l.process_date,
        created_at: l.created_at,
        parsed: l.date?.toISOString()
      })));
      
      // Contar processos após startDate usando !isBefore (inclui a data de início)
      const afterStartDate = lawsuits.filter(l => {
        const createdDate = getCreatedOrProcessDate(l);
        if (!createdDate) return false;
        return !isBefore(createdDate, startDate!);
      }).length;
      console.log('[Debug] Lawsuits on or after startDate:', afterStartDate);
    }

    // Filtrar lawsuits por tipo e área se filtros estiverem ativos
    let filteredForEvolution = lawsuits;
    const hasTypeFilter = !showAllEvolutionTypes && selectedEvolutionTypes.length > 0;
    const hasAreaFilter = !showAllEvolutionAreas && selectedEvolutionAreas.length > 0;

    if (hasTypeFilter) {
      filteredForEvolution = filteredForEvolution.filter(
        (lawsuit) => lawsuit.type && selectedEvolutionTypes.includes(lawsuit.type),
      );
    }

    if (hasAreaFilter) {
      filteredForEvolution = filteredForEvolution.filter(
        (lawsuit) => lawsuit.group && selectedEvolutionAreas.includes(lawsuit.group),
      );
    }

    // Para "todos os períodos" sem filtros, usar totalCount da API como base
    // já que representa o total real de processos ativos no Advbox
    const useApiTotal = !startDate && !hasTypeFilter && !hasAreaFilter;

    // Contar processos ativos (sem data de arquivamento) nos dados carregados
    const activeInLoaded = filteredForEvolution.filter((lawsuit) => {
      return !getArchiveDate(lawsuit);
    }).length;

    // Contar processos arquivados nos dados carregados (usando !isBefore para incluir a data de início)
    const archivedInLoaded = filteredForEvolution.filter((lawsuit) => {
      const archiveDate = getArchiveDate(lawsuit);
      if (!archiveDate) return false;
      if (!startDate) return true;
      return !isBefore(archiveDate, startDate);
    }).length;

    // Para "processos novos":
    // - Se "todos" e sem filtros: usar totalCount da API (representa todos processos no Advbox)
    // - Se período específico: contar processos criados no período nos dados carregados
    let newProcesses: number;
    if (useApiTotal && totalLawsuits) {
      // Total de processos ativos no Advbox
      newProcesses = totalLawsuits;
    } else if (!startDate) {
      // "Todos" com filtros - contar nos dados carregados
      newProcesses = filteredForEvolution.length;
    } else {
      // Período específico - contar processos criados no período (usando !isBefore para incluir a data de início)
      newProcesses = filteredForEvolution.filter((lawsuit) => {
        const createdDate = getCreatedOrProcessDate(lawsuit);
        if (!createdDate) return false;
        return !isBefore(createdDate, startDate);
      }).length;
    }

    // Quebra por área (group) - baseado nos dados carregados
    const newByArea: { [key: string]: number } = {};
    filteredForEvolution.forEach((lawsuit) => {
      const createdDate = getCreatedOrProcessDate(lawsuit);
      if (!createdDate) return;
      if (!startDate || !isBefore(createdDate, startDate)) {
        const area = lawsuit.group || 'Não informado';
        newByArea[area] = (newByArea[area] || 0) + 1;
      }
    });

    // Dados são completos se hasCompleteData é true OU se carregamos todos os processos
    const dataIsComplete = hasCompleteData || (totalLawsuits && lawsuits.length >= totalLawsuits);
    
    return {
      newProcesses,
      archivedProcesses: archivedInLoaded,
      activeProcesses: activeInLoaded,
      isPartialData: !dataIsComplete,
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
    // Carregar movimentações completas automaticamente ao montar
    loadFullMovements();
  }, []);

  // Filtrar processos locais quando dados carregam (para período padrão de 30 dias)
  useEffect(() => {
    if (lawsuits.length > 0 && evolutionPeriod !== 'all') {
      const days = parseInt(evolutionPeriod);
      const startDate = startOfDay(subDays(new Date(), days));
      
      const recentFromCache = lawsuits.filter((lawsuit) => {
        const createdDate = getCreatedOrProcessDate(lawsuit);
        if (!createdDate) return false;
        return !isBefore(createdDate, startDate);
      });
      
      setRecentLawsuits(recentFromCache);
      setRecentLawsuitsStartDate(format(startDate, 'yyyy-MM-dd'));
    }
  }, [lawsuits.length]);

  const fetchData = async (forceRefresh = false, loadFullData = false) => {
    try {
      const refreshParam = forceRefresh ? '?force_refresh=true' : '';
      
      // Se solicitado, buscar dados completos com paginação
      const lawsuitsEndpoint = loadFullData 
        ? `advbox-integration/lawsuits-full${refreshParam}`
        : `advbox-integration/lawsuits${refreshParam}`;
      
      const [lawsuitsRes, movementsRes] = await Promise.all([
        supabase.functions.invoke(lawsuitsEndpoint),
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
      
      // Debug: Verificar TODOS os campos disponíveis no processo
      if (lawsuitsArray.length > 0) {
        const firstLawsuit = lawsuitsArray[0] as any;
        console.log('[Debug] ALL FIELDS in first lawsuit:', Object.keys(firstLawsuit));
        
        // Log ALL date-like fields (expanded search)
        const dateFields: Record<string, any> = {};
        Object.entries(firstLawsuit).forEach(([key, value]) => {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('date') || keyLower.includes('data') || 
              keyLower.includes('inicio') || keyLower.includes('início') ||
              keyLower.includes('created') || keyLower.includes('updated') ||
              keyLower.includes('start') || keyLower.includes('distribution') ||
              keyLower.includes('distribuicao') || keyLower.includes('distribuição') ||
              keyLower.includes('process') || keyLower.includes('entrada') ||
              keyLower.includes('cadastro') || keyLower.includes('abertura') ||
              keyLower.includes('closure') || keyLower.includes('exit') ||
              keyLower.includes('saida') || keyLower.includes('saída') ||
              (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
            dateFields[key] = value;
          }
        });
        console.log('[Debug] DATE-LIKE FIELDS in first lawsuit:', dateFields);
        console.log('[Debug] FULL FIRST LAWSUIT:', JSON.stringify(firstLawsuit, null, 2));
        
        // Count lawsuits with various date fields
        const withProcessDate = lawsuitsArray.filter((l: any) => l.process_date).length;
        const withCreatedAt = lawsuitsArray.filter((l: any) => l.created_at).length;
        const withStatusClosure = lawsuitsArray.filter((l: any) => l.status_closure).length;
        const withExitProduction = lawsuitsArray.filter((l: any) => l.exit_production).length;
        console.log(`[Debug] Lawsuits with process_date: ${withProcessDate} of ${lawsuitsArray.length}`);
        console.log(`[Debug] Lawsuits with created_at: ${withCreatedAt} of ${lawsuitsArray.length}`);
        console.log(`[Debug] Lawsuits with status_closure: ${withStatusClosure} of ${lawsuitsArray.length}`);
        console.log(`[Debug] Lawsuits with exit_production: ${withExitProduction} of ${lawsuitsArray.length}`);
        
        // Analyze date distribution - find most recent dates for each field
        const getMaxDate = (field: string) => {
          const dates = lawsuitsArray
            .map((l: any) => l[field])
            .filter((d: any) => d)
            .map((d: string) => new Date(d.replace(' ', 'T')))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (dates.length === 0) return null;
          return new Date(Math.max(...dates.map((d: Date) => d.getTime())));
        };
        
        console.log('[Debug] MOST RECENT DATES:');
        console.log('  - process_date:', getMaxDate('process_date')?.toISOString() || 'N/A');
        console.log('  - created_at:', getMaxDate('created_at')?.toISOString() || 'N/A');
        console.log('  - status_closure:', getMaxDate('status_closure')?.toISOString() || 'N/A');
        console.log('  - exit_production:', getMaxDate('exit_production')?.toISOString() || 'N/A');
        
        // Check for 2024/2025 processes
        const recentYearProcesses = lawsuitsArray.filter((l: any) => {
          const date = l.process_date || l.created_at;
          if (!date) return false;
          const year = new Date(date.replace(' ', 'T')).getFullYear();
          return year >= 2024;
        });
        console.log(`[Debug] Processes from 2024/2025: ${recentYearProcesses.length} of ${lawsuitsArray.length}`);
        
        // Year distribution
        const yearDistribution: Record<number, number> = {};
        lawsuitsArray.forEach((l: any) => {
          const date = l.process_date || l.created_at;
          if (date) {
            const year = new Date(date.replace(' ', 'T')).getFullYear();
            yearDistribution[year] = (yearDistribution[year] || 0) + 1;
          }
        });
        console.log('[Debug] YEAR DISTRIBUTION:', yearDistribution);
      }

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
      
      // Verificar se temos dados completos
      const isComplete = (rawLawsuits as any)?.isComplete === true || finalLawsuits.length >= lawsuitsTotal;
      setHasCompleteData(isComplete);
      
      if (isComplete) {
        console.log('Complete data loaded:', finalLawsuits.length, 'of', lawsuitsTotal);
      }

      // Atualizar cache apenas quando tivermos dados de processos
      try {
        if (finalLawsuits.length > 0) {
          // Para dados completos (>5000), armazenar apenas campos essenciais para evitar quota exceeded
          const lawsuitsToCache = finalLawsuits.length > 5000
            ? finalLawsuits.map(l => ({
                id: l.id,
                created_at: l.created_at,
                process_date: l.process_date, // Data real do processo - CRÍTICO para métricas
                status_closure: l.status_closure,
                exit_production: l.exit_production,
                exit_execution: l.exit_execution,
                group: l.group,
                type: l.type,
                process_number: l.process_number,
                responsible: l.responsible,
              }))
            : finalLawsuits;
          
          const cacheData = {
            lawsuits: lawsuitsToCache,
            movements: finalMovements,
            totalLawsuits: lawsuitsTotal,
            totalMovements: movementsTotal,
            metadata: rootMetadata || null,
            isComplete,
            isMinimalCache: finalLawsuits.length > 5000,
          };
          
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, updateTime.toISOString());
          } catch (storageError) {
            // Se ainda exceder, limpar cache antigo e tentar novamente com dados mínimos
            console.warn('Cache storage exceeded, using minimal data...');
            localStorage.removeItem(CACHE_KEY);
            
            const minimalCache = {
              lawsuits: finalLawsuits.map(l => ({
                id: l.id,
                created_at: l.created_at,
                process_date: l.process_date, // Data real do processo - CRÍTICO
                status_closure: l.status_closure,
                exit_production: l.exit_production,
                exit_execution: l.exit_execution,
                group: l.group,
                type: l.type,
              })),
              movements: [],
              totalLawsuits: lawsuitsTotal,
              totalMovements: movementsTotal,
              metadata: null,
              isComplete,
              isMinimalCache: true,
            };
            
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(minimalCache));
              localStorage.setItem(CACHE_TIMESTAMP_KEY, updateTime.toISOString());
            } catch {
              // Se ainda falhar, apenas mantenha os dados em memória
              console.warn('Unable to cache data, keeping in memory only');
            }
          }
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
      setIsLoadingFullData(false);
    }
  };
  
  // Função para carregar todos os processos
  const loadFullData = async () => {
    setIsLoadingFullData(true);
    toast({
      title: 'Carregando todos os processos',
      description: 'Isso pode levar alguns minutos devido às limitações da API do Advbox...',
    });
    await fetchData(true, true);
    toast({
      title: hasCompleteData ? 'Dados completos carregados!' : 'Carregamento concluído',
      description: `${lawsuits.length.toLocaleString()} processos carregados.`,
    });
  };

  // Estado para controlar loading de processos recentes
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentLawsuits, setRecentLawsuits] = useState<Lawsuit[]>([]);
  const [recentLawsuitsStartDate, setRecentLawsuitsStartDate] = useState<string | null>(null);
  
  // Estado para movimentações completas (inicializa com cache se disponível)
  const [fullMovements, setFullMovements] = useState<Movement[]>(cachedMovements || []);
  const [hasFullMovements, setHasFullMovements] = useState(!!cachedMovements && cachedMovements.length > 100);

  // Função auxiliar para salvar movimentações no cache
  const saveMovementsToCache = (movementsData: Movement[]) => {
    try {
      // Salvar apenas campos essenciais para evitar quota exceeded
      const minimalMovements = movementsData.map(m => ({
        lawsuit_id: m.lawsuit_id,
        date: m.date,
        title: m.title,
        header: m.header,
        process_number: m.process_number,
        protocol_number: m.protocol_number,
        customers: m.customers,
      }));
      localStorage.setItem(MOVEMENTS_CACHE_KEY, JSON.stringify(minimalMovements));
      localStorage.setItem(MOVEMENTS_CACHE_TIMESTAMP_KEY, new Date().toISOString());
      console.log(`[Movements Cache] Saved ${minimalMovements.length} movements to cache`);
    } catch (error) {
      console.warn('Error saving movements to cache:', error);
      // Se exceder quota, limpar e tentar novamente com menos dados
      try {
        localStorage.removeItem(MOVEMENTS_CACHE_KEY);
        localStorage.removeItem(MOVEMENTS_CACHE_TIMESTAMP_KEY);
      } catch {
        // Ignorar erro de limpeza
      }
    }
  };

  // Função para buscar TODAS as movimentações
  const loadFullMovements = async () => {
    console.log('[Movements] Loading all movements...');
    try {
      const { data, error } = await supabase.functions.invoke(
        'advbox-integration/movements-full'
      );

      if (error) throw error;

      const movementsData = data?.data || [];
      console.log(`[Movements] Loaded ${movementsData.length} movements`);
      
      setFullMovements(movementsData);
      setHasFullMovements(true);
      
      // Atualizar também o estado principal se tiver mais dados
      if (movementsData.length > movements.length) {
        setMovements(movementsData);
        setTotalMovements(movementsData.length);
      }
      
      // Salvar no cache local
      saveMovementsToCache(movementsData);
      
      return movementsData;
    } catch (error) {
      console.error('Error fetching full movements:', error);
      return movements; // Fallback para movimentações existentes
    }
  };

  // Função para buscar processos recentes usando filtro de data da API
  const loadRecentLawsuits = async (days: number) => {
    setIsLoadingRecent(true);
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    
    toast({
      title: `Buscando dados dos últimos ${days} dias`,
      description: `Carregando processos e movimentações desde ${startDate}...`,
    });

    try {
      // Buscar processos e movimentações em paralelo
      const [lawsuitsResult, movementsResult] = await Promise.all([
        supabase.functions.invoke(
          `advbox-integration/lawsuits-recent?start_date=${startDate}&force_refresh=true`
        ),
        // Buscar todas as movimentações apenas se ainda não temos (e não temos cache)
        !hasFullMovements ? supabase.functions.invoke('advbox-integration/movements-full') : Promise.resolve({ data: { data: fullMovements } })
      ]);

      if (lawsuitsResult.error) throw lawsuitsResult.error;

      const recentData = lawsuitsResult.data?.data || [];
      const totalFound = lawsuitsResult.data?.totalCount || recentData.length;
      
      console.log(`[Recent Lawsuits] Found ${recentData.length} processes from ${startDate}`);
      
      // Log sample para debug
      if (recentData.length > 0) {
        console.log('[Recent Lawsuits] Sample:', recentData.slice(0, 3).map((l: any) => ({
          id: l.id,
          process_date: l.process_date,
          created_at: l.created_at,
        })));
      }

      setRecentLawsuits(recentData);
      setRecentLawsuitsStartDate(startDate);
      
      // Processar movimentações se vieram novas
      if (movementsResult.data?.data && movementsResult.data.data.length > 0 && !hasFullMovements) {
        const movementsData = movementsResult.data.data;
        setFullMovements(movementsData);
        setHasFullMovements(true);
        if (movementsData.length > movements.length) {
          setMovements(movementsData);
          setTotalMovements(movementsData.length);
        }
        // Salvar no cache local
        saveMovementsToCache(movementsData);
        console.log(`[Movements] Loaded and cached ${movementsData.length} movements`);
      }

      toast({
        title: 'Dados carregados',
        description: `${totalFound} processos novos e ${hasFullMovements || movementsResult.data?.data?.length ? (movementsResult.data?.data?.length || fullMovements.length) : movements.length} movimentações carregadas.`,
      });
    } catch (error) {
      console.error('Error fetching recent data:', error);
      toast({
        title: 'Erro ao buscar dados',
        description: error instanceof Error ? error.message : 'Não foi possível buscar os dados.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // Função para limpar cache e forçar recarregamento completo
  const clearCacheAndReload = async () => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(MOVEMENTS_CACHE_KEY);
    localStorage.removeItem(MOVEMENTS_CACHE_TIMESTAMP_KEY);
    setLawsuits([]);
    setMovements([]);
    setFullMovements([]);
    setHasFullMovements(false);
    setHasCompleteData(false);
    toast({
      title: 'Cache limpo',
      description: 'Recarregando dados do Advbox...',
    });
    setLoading(true);
    await fetchData(false, false);
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
            <Button
              variant="outline"
              size="sm"
              onClick={clearCacheAndReload}
              className="gap-2"
              title="Limpar cache e recarregar dados"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar Dados
            </Button>
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
                <Select 
                  value={evolutionPeriod} 
                  onValueChange={(value) => {
                    setEvolutionPeriod(value);
                    // Usar dados cacheados localmente ao invés de chamar API
                    // A atualização dos dados acontece automaticamente via cache refresh diário
                    if (value === 'all') {
                      // Limpar filtro de recentes quando volta para "todos"
                      setRecentLawsuits([]);
                      setRecentLawsuitsStartDate(null);
                    } else {
                      // Filtrar dados localmente do cache
                      const days = parseInt(value);
                      const startDate = startOfDay(subDays(new Date(), days));
                      
                      // Filtrar processos locais pelo período
                      const recentFromCache = lawsuits.filter((lawsuit) => {
                        const createdDate = getCreatedOrProcessDate(lawsuit);
                        if (!createdDate) return false;
                        return !isBefore(createdDate, startDate);
                      });
                      
                      setRecentLawsuits(recentFromCache);
                      setRecentLawsuitsStartDate(format(startDate, 'yyyy-MM-dd'));
                      
                      console.log(`[Cache Filter] ${recentFromCache.length} processos encontrados no período de ${days} dias (dados locais)`);
                    }
                  }}
                >
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
              {!hasCompleteData && (
                <div className="flex flex-col gap-3 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700">
                        Dados parciais: {lawsuits.length.toLocaleString()} de {totalLawsuits?.toLocaleString() || '?'} processos carregados.
                        <span className="block mt-1">Use o filtro de período acima para buscar processos novos diretamente pela API.</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadFullData}
                      disabled={isLoadingFullData}
                      className="shrink-0 text-xs"
                    >
                      {isLoadingFullData ? 'Carregando...' : 'Carregar Todos'}
                    </Button>
                  </div>
                  
                  {recentLawsuits.length > 0 && recentLawsuitsStartDate && (
                    <div className="text-xs text-green-700 bg-green-500/10 p-2 rounded flex items-center justify-between">
                      <span>
                        Processos novos (desde {format(new Date(recentLawsuitsStartDate), 'dd/MM/yyyy')}): 
                        <strong> {recentLawsuits.length}</strong> encontrados via API
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-green-600"
                        onClick={() => {
                          setRecentLawsuits([]);
                          setRecentLawsuitsStartDate(null);
                          setEvolutionPeriod('all');
                        }}
                      >
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {hasCompleteData && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Briefcase className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-700">
                    Dados completos: {lawsuits.length.toLocaleString()} processos carregados. 
                    Os contadores de "Processos Novos" refletem dados reais.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* PROCESSOS ATIVOS - Sempre mostra o total real, independente do período */}
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {searchTerm || !showAllResponsibles 
                      ? filteredLawsuits.length 
                      : (totalLawsuits ?? filteredLawsuits.length)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {searchTerm || !showAllResponsibles ? 'Processos Filtrados' : 'Processos Ativos'}
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    Total atual no Advbox
                  </div>
                </div>
                
                {/* MOVIMENTAÇÕES NO PERÍODO - Filtra das movimentações completas */}
                <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 flex items-center justify-center gap-2">
                    {(() => {
                      // Usar fullMovements se disponível, senão usar movements
                      const movementsToUse = hasFullMovements && fullMovements.length > 0 ? fullMovements : movements;
                      
                      // Filtrar pelo período de evolução selecionado
                      const getEvolutionDateFilter = () => {
                        const now = new Date();
                        switch (evolutionPeriod) {
                          case '7':
                            return startOfDay(subDays(now, 7));
                          case '30':
                            return startOfDay(subDays(now, 30));
                          case '90':
                            return startOfDay(subMonths(now, 3));
                          default:
                            return null;
                        }
                      };
                      const evolutionDateFilter = getEvolutionDateFilter();
                      
                      if (evolutionDateFilter) {
                        const filteredByEvolution = movementsToUse.filter(m => {
                          const movementDate = new Date(m.date);
                          return !isBefore(movementDate, evolutionDateFilter);
                        });
                        return filteredByEvolution.length;
                      }
                      return totalMovements ?? movementsToUse.length;
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Movimentações {evolutionPeriod !== 'all' ? 'no Período' : 'Recentes'}
                  </div>
                  {evolutionPeriod !== 'all' && (
                    <div className="text-xs text-muted-foreground/60 mt-0.5">
                      Últimos {evolutionPeriod} dias
                      {hasFullMovements && <span className="ml-1 text-green-600">(cache local)</span>}
                    </div>
                  )}
                </div>
                <div className="text-center p-4 bg-green-500/5 rounded-lg border-2 border-green-500/20">
                  <div className="text-3xl font-bold text-green-600">
                    {recentLawsuits.length > 0 ? (
                      recentLawsuits.length
                    ) : evolutionPeriod === 'all' ? (
                      hasCompleteData ? evolutionMetrics.newProcesses : '—'
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Processos Novos
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {recentLawsuits.length > 0 && recentLawsuitsStartDate
                      ? `Desde ${format(new Date(recentLawsuitsStartDate), 'dd/MM')} (cache local)`
                      : evolutionPeriod === 'all' 
                        ? (hasCompleteData ? 'Total geral' : 'Selecione um período') 
                        : `Últimos ${evolutionPeriod} dias`}
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
                    {evolutionPeriod === 'all' 
                      ? (hasCompleteData ? 'Total geral' : 'Na amostra carregada') 
                      : `Últimos ${evolutionPeriod} dias`}
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg ${recentLawsuits.length > 0 ? (recentLawsuits.length - evolutionMetrics.archivedProcesses >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5') : (netGrowth >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5')}`}>
                  <div className={`text-3xl font-bold ${recentLawsuits.length > 0 ? (recentLawsuits.length - evolutionMetrics.archivedProcesses >= 0 ? 'text-emerald-600' : 'text-red-600') : (netGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')} flex items-center justify-center gap-1`}>
                    {recentLawsuits.length > 0 ? (
                      <>
                        {recentLawsuits.length - evolutionMetrics.archivedProcesses >= 0 ? '+' : ''}{recentLawsuits.length - evolutionMetrics.archivedProcesses}
                      </>
                    ) : (
                      <>
                        {netGrowth >= 0 ? '+' : ''}{netGrowth}
                      </>
                    )}
                    {(recentLawsuits.length > 0 ? (recentLawsuits.length - evolutionMetrics.archivedProcesses >= 0) : (netGrowth >= 0)) ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingUp className="h-5 w-5 rotate-180" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Crescimento Líquido
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    Novos - Arquivados
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seções Expansíveis */}
          <div className="lg:col-span-3">
            <Accordion type="multiple" className="space-y-4">

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
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openMessageDialog(lawsuit)}
                                  disabled={sendingDocRequest === lawsuit.id}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  {sendingDocRequest === lawsuit.id ? 'Enviando...' : 'Enviar Mensagem'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openTaskDialogFromLawsuit(lawsuit)}
                                >
                                  <ListTodo className="h-4 w-4 mr-1" />
                                  Criar Tarefa
                                </Button>
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

                    {/* Sugestões de Tarefas */}
                    <TaskSuggestionsPanel
                      items={filteredMovements.map(m => ({
                        id: `${m.lawsuit_id}-${m.date}`,
                        title: m.title,
                        type: m.title,
                        process_number: m.process_number,
                        lawsuit_id: m.lawsuit_id,
                      }))}
                      lawsuits={lawsuits}
                    />

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
        <TaskCreationDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          selectedMovement={selectedMovement}
          lawsuits={lawsuits}
          onTaskCreated={() => {
            setSelectedMovement(null);
            toast({
              title: 'Tarefa criada',
              description: 'Tarefa criada com sucesso no Advbox.',
            });
          }}
        />

        {/* Dialog de Envio de Mensagem */}
        <Dialog open={!!messageDialogLawsuit} onOpenChange={(open) => !open && closeMessageDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar Mensagem</DialogTitle>
              <DialogDescription>
                Selecione o tipo de mensagem que deseja enviar para o cliente do processo{' '}
                <span className="font-semibold">{messageDialogLawsuit?.process_number}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label className="text-sm font-medium mb-3 block">Tipo de Mensagem</Label>
              <RadioGroup value={selectedMessageType} onValueChange={setSelectedMessageType}>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="cobranca_documentos" id="cobranca_documentos" />
                  <Label htmlFor="cobranca_documentos" className="flex-1 cursor-pointer">
                    <span className="font-medium">Cobrança de Documentos</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Solicita ao cliente os documentos necessários para o processo
                    </p>
                  </Label>
                </div>
                {/* Adicionar mais tipos de mensagem aqui no futuro */}
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={closeMessageDialog}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSendMessage} 
                disabled={!selectedMessageType || sendingDocRequest === messageDialogLawsuit?.id}
              >
                <Send className="h-4 w-4 mr-1" />
                {sendingDocRequest === messageDialogLawsuit?.id ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
