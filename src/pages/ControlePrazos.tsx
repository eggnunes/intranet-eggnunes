import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarIcon, Filter, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseLocalDate, formatLocalDate } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Keywords that identify procedural deadlines (inclusion logic)
const INCLUDED_TASK_KEYWORDS = [
  'PETIÇÃO',
  'PROTOCOLO',
  'EMBARGOS',
  'IMPUGNAÇÃO',
  'CONTRARRAZÕES',
  'RECURSO',
  'APELAÇÃO',
  'AGRAVO',
  'CUMPRIMENTO DE SENTENÇA',
  'MANIFESTAÇÃO',
  'ALEGAÇÕES FINAIS',
  'CONTRAMINUTA',
  'AUDIÊNCIA',
  'DISTRIBUIÇÃO',
  'EMENDA À INICIAL',
  'COMPLEMENTAÇÃO',
  'ANÁLISE DE DECISÃO',
  'ELABORAÇÃO DE CÁLCULO',
  'AVALIAR DOCUMENTAÇÃO',
  'REQUERIMENTO',
  'SUSTENTAÇÃO ORAL',
  'PREPARAR SUSTENTAÇÃO',
  'INSTRUIR DOCUMENTOS',
  'PRECATÓRIO',
  'CORREÇÃO PEQUENA',
  'REVISÃO DE PETIÇÃO',
  'PESQUISA DE JURISPRUDÊNCIA',
  'ANÁLISE DE CASO',
  'GUIA DE CUSTAS',
  'DEPÓSITO JUDICIAL',
  'PREPARAR TESTEMUNHA',
  'CARTA DE INTIMAÇÃO',
  'INTIMAÇÃO DE TESTEMUNHA',
];

interface AdvboxTask {
  id: string;
  advbox_id: number;
  title: string;
  task_type: string | null;
  due_date: string | null;
  status: string;
  assigned_users: string | null;
  process_number: string | null;
  raw_data: any;
  completed_at: string | null;
}

interface PrazoVerificacao {
  id: string;
  advbox_task_id: string;
  verificado_por: string | null;
  verificado_em: string;
  observacoes: string | null;
  status: string;
}

interface ProcessedTask extends AdvboxTask {
  data_publicacao: string | null;
  prazo_interno: string | null;
  prazo_fatal: string | null;
  verificacao: PrazoVerificacao | null;
}

const PAGE_SIZE = 50;

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const isPrazoVencido = (task: ProcessedTask): boolean => {
  if (!task.prazo_fatal) return false;
  if (task.status === 'completed') return false;
  if (task.verificacao?.status === 'verificado') return false;
  const todayStr = getTodayStr();
  const prazoStr = task.prazo_fatal.substring(0, 10);
  return prazoStr < todayStr;
};

export default function ControlePrazos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<AdvboxTask[]>([]);
  const [verificacoes, setVerificacoes] = useState<PrazoVerificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProcessedTask | null>(null);
  const [verifyObservacoes, setVerifyObservacoes] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'verificado' | 'com_pendencia'>('verificado');
  const [currentPage, setCurrentPage] = useState(0);

  // Filters
  const [filterAdvogado, setFilterAdvogado] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipoTarefa, setFilterTipoTarefa] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterPrazoFatalFrom, setFilterPrazoFatalFrom] = useState<Date | undefined>(undefined);
  const [filterPrazoFatalTo, setFilterPrazoFatalTo] = useState<Date | undefined>(undefined);
  const [filterEventoFrom, setFilterEventoFrom] = useState<Date | undefined>(undefined);
  const [filterEventoTo, setFilterEventoTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllTasks = async (): Promise<AdvboxTask[]> => {
    const batchSize = 1000;
    let allTasks: AdvboxTask[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('advbox_tasks')
        .select('id, advbox_id, title, task_type, due_date, status, assigned_users, process_number, raw_data, completed_at')
        .order('due_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      allTasks = allTasks.concat((data as AdvboxTask[]) || []);
      hasMore = (data?.length || 0) === batchSize;
      offset += batchSize;
    }
    return allTasks;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allTasks, verificacoesRes] = await Promise.all([
        fetchAllTasks(),
        supabase.from('prazo_verificacoes').select('*'),
      ]);

      if (verificacoesRes.error) throw verificacoesRes.error;

      setTasks(allTasks);
      setVerificacoes((verificacoesRes.data as PrazoVerificacao[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-advbox-tasks', {
        body: { sync_type: 'full' },
      });
      if (error) throw error;
      toast({
        title: 'Sincronização concluída',
        description: `${data?.total_upserted || 0} tarefas sincronizadas do ADVBox.`,
      });
      await fetchData();
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedTask || !user) return;
    try {
      const { error } = await supabase.from('prazo_verificacoes').insert({
        advbox_task_id: String(selectedTask.advbox_id),
        verificado_por: user.id,
        status: verifyStatus,
        observacoes: verifyObservacoes || null,
      });
      if (error) throw error;
      toast({ title: verifyStatus === 'verificado' ? 'Prazo verificado' : 'Pendência registrada' });
      setVerifyDialogOpen(false);
      setVerifyObservacoes('');
      setVerifyStatus('verificado');
      setSelectedTask(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Erro ao registrar verificação', description: error.message, variant: 'destructive' });
    }
  };

  const openVerifyDialog = (task: ProcessedTask) => {
    setSelectedTask(task);
    setVerifyObservacoes('');
    setVerifyStatus('verificado');
    setVerifyDialogOpen(true);
  };

  // Process tasks: filter excluded types, extract dates from raw_data, match verificacoes
  const processedTasks: ProcessedTask[] = useMemo(() => {
    const verificacaoMap = new Map<string, PrazoVerificacao>();
    verificacoes.forEach(v => {
      const existing = verificacaoMap.get(v.advbox_task_id);
      if (!existing || new Date(v.verificado_em) > new Date(existing.verificado_em)) {
        verificacaoMap.set(v.advbox_task_id, v);
      }
    });

    return tasks
      .filter(task => {
        // Include only procedural deadline task types
        const taskType = (task.task_type || task.title || '').toUpperCase();
        if (!INCLUDED_TASK_KEYWORDS.some(keyword => taskType.includes(keyword))) return false;

        // Exclude tasks assigned exclusively to Mariana
        const assignedUsers = task.assigned_users || '';
        const users = assignedUsers.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
        if (users.length > 0 && users.every(u => u.includes('mariana'))) return false;

        return true;
      })
      .map(task => {
        const rawData = task.raw_data || {};
        return {
          ...task,
          data_publicacao: rawData.created_at || null,
          prazo_interno: rawData.date || null,
          prazo_fatal: rawData.date_deadline || task.due_date || null,
          verificacao: verificacaoMap.get(String(task.advbox_id)) || null,
        };
      });
  }, [tasks, verificacoes]);

  // Get unique lawyers for filter dropdown
  const advogados = useMemo(() => {
    const set = new Set<string>();
    processedTasks.forEach(t => {
      if (t.assigned_users) {
        t.assigned_users.split(',').map(u => u.trim()).filter(Boolean).forEach(u => set.add(u));
      }
    });
    return Array.from(set).sort();
  }, [processedTasks]);

  // Get unique task types for filter dropdown
  const tiposTarefa = useMemo(() => {
    const set = new Set<string>();
    processedTasks.forEach(t => {
      if (t.task_type) set.add(t.task_type);
    });
    return Array.from(set).sort();
  }, [processedTasks]);

  // Apply filters
  const filteredTasks = useMemo(() => {
    return processedTasks.filter(task => {
      if (filterAdvogado !== 'all') {
        const users = (task.assigned_users || '').split(',').map(u => u.trim());
        if (!users.includes(filterAdvogado)) return false;
      }
      if (filterTipoTarefa !== 'all') {
        if ((task.task_type || '') !== filterTipoTarefa) return false;
      }
      if (filterStatus !== 'all') {
        if (filterStatus === 'pendente' && task.verificacao) return false;
        if (filterStatus === 'verificado' && task.verificacao?.status !== 'verificado') return false;
        if (filterStatus === 'com_pendencia' && task.verificacao?.status !== 'com_pendencia') return false;
        if (filterStatus === 'vencido' && !isPrazoVencido(task)) return false;
      }
      if (filterDateFrom && task.data_publicacao) {
        const pubDate = new Date(task.data_publicacao);
        if (pubDate < filterDateFrom) return false;
      }
      if (filterDateTo && task.data_publicacao) {
        const pubDate = new Date(task.data_publicacao);
        const endOfDay = new Date(filterDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (pubDate > endOfDay) return false;
      }
      if (filterPrazoFatalFrom && task.prazo_fatal) {
        const fatalDate = new Date(task.prazo_fatal);
        if (fatalDate < filterPrazoFatalFrom) return false;
      }
      if (filterPrazoFatalTo && task.prazo_fatal) {
        const fatalDate = new Date(task.prazo_fatal);
        const endOfDay = new Date(filterPrazoFatalTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (fatalDate > endOfDay) return false;
      }
      return true;
    });
  }, [processedTasks, filterAdvogado, filterTipoTarefa, filterStatus, filterDateFrom, filterDateTo, filterPrazoFatalFrom, filterPrazoFatalTo]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [filterAdvogado, filterTipoTarefa, filterStatus, filterDateFrom, filterDateTo, filterPrazoFatalFrom, filterPrazoFatalTo]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredTasks.slice(start, start + PAGE_SIZE);
  }, [filteredTasks, currentPage]);

  const getVerificacaoBadge = (task: ProcessedTask) => {
    if (task.status === 'completed') {
      return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300">Concluída no ADVBox</Badge>;
    }
    if (!task.verificacao && isPrazoVencido(task)) {
      return <Badge className="bg-red-600 text-white border-red-600">⚠ VENCIDO</Badge>;
    }
    if (!task.verificacao) {
      return <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">Pendente</Badge>;
    }
    if (task.verificacao.status === 'verificado') {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-300">Verificado</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-300">Com Pendência</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      // Handle ISO datetime strings
      if (dateStr.includes('T') || dateStr.length > 10) {
        return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
      }
      return formatLocalDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  const getTaskStatusLabel = (task: ProcessedTask): string => {
    if (task.status === 'completed') return 'Concluída no ADVBox';
    if (!task.verificacao && isPrazoVencido(task)) return 'VENCIDO';
    if (!task.verificacao) return 'Pendente';
    if (task.verificacao.status === 'verificado') return 'Verificado';
    return 'Com Pendência';
  };

  // Export helpers
  const getExportData = useCallback(() => {
    return filteredTasks.map(task => ({
      'Nº Processo': task.process_number || 'Sem número',
      'Tarefa': task.title,
      'Tipo': task.task_type || '-',
      'Advogado': task.assigned_users || 'Sem responsável',
      'Data Publicação': formatDate(task.data_publicacao),
      'Prazo Interno': formatDate(task.prazo_interno),
      'Prazo Fatal': formatDate(task.prazo_fatal),
      'Status': getTaskStatusLabel(task),
    }));
  }, [filteredTasks]);

  const handleExportExcel = useCallback(() => {
    const data = getExportData();
    if (data.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle de Prazos');
    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2
    }));
    ws['!cols'] = colWidths;
    XLSX.writeFile(wb, `controle-prazos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Excel exportado com sucesso' });
  }, [getExportData, toast]);

  const handleExportPDF = useCallback(() => {
    const data = getExportData();
    if (data.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Controle de Prazos — Coordenação', 14, 15);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })} | Total: ${data.length} tarefas`, 14, 22);

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => (row as any)[h]));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 27,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === headers.indexOf('Status')) {
          const val = String(data.cell.raw);
          if (val === 'VENCIDO') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    doc.save(`controle-prazos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso' });
  }, [getExportData, toast]);

  // Stats
  const totalPendentes = processedTasks.filter(t => !t.verificacao && t.status !== 'completed').length;
  const totalVerificados = processedTasks.filter(t => t.verificacao?.status === 'verificado').length;
  const totalComPendencia = processedTasks.filter(t => t.verificacao?.status === 'com_pendencia').length;
  const totalConcluidas = processedTasks.filter(t => t.status === 'completed').length;
  const totalVencidos = processedTasks.filter(t => isPrazoVencido(t)).length;

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Controle de Prazos — Coordenação</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhamento de prazos processuais das tarefas do ADVBox
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? 'Sincronizando...' : 'Sincronizar ADVBox'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{totalPendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(totalVencidos > 0 && "border-red-400 dark:border-red-600")}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{totalVencidos}</p>
                  <p className="text-xs text-muted-foreground">Prazos Vencidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalVerificados}</p>
                  <p className="text-xs text-muted-foreground">Verificados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{totalComPendencia}</p>
                  <p className="text-xs text-muted-foreground">Com Pendência</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalConcluidas}</p>
                  <p className="text-xs text-muted-foreground">Concluídas ADVBox</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Select value={filterAdvogado} onValueChange={setFilterAdvogado}>
                <SelectTrigger>
                  <SelectValue placeholder="Advogado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os advogados</SelectItem>
                  {advogados.map(adv => (
                    <SelectItem key={adv} value={adv}>{adv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTipoTarefa} onValueChange={setFilterTipoTarefa}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Tarefa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {tiposTarefa.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="vencido">⚠ Vencido</SelectItem>
                  <SelectItem value="verificado">Verificado</SelectItem>
                  <SelectItem value="com_pendencia">Com Pendência</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterDateFrom ? format(filterDateFrom, 'dd/MM/yyyy') : 'Publicação início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDateFrom}
                    onSelect={setFilterDateFrom}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterDateTo ? format(filterDateTo, 'dd/MM/yyyy') : 'Publicação fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDateTo}
                    onSelect={setFilterDateTo}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !filterPrazoFatalFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterPrazoFatalFrom ? format(filterPrazoFatalFrom, 'dd/MM/yyyy') : 'Prazo Fatal início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterPrazoFatalFrom}
                    onSelect={setFilterPrazoFatalFrom}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !filterPrazoFatalTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterPrazoFatalTo ? format(filterPrazoFatalTo, 'dd/MM/yyyy') : 'Prazo Fatal fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterPrazoFatalTo}
                    onSelect={setFilterPrazoFatalTo}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(filterAdvogado !== 'all' || filterStatus !== 'all' || filterTipoTarefa !== 'all' || filterDateFrom || filterDateTo || filterPrazoFatalFrom || filterPrazoFatalTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setFilterAdvogado('all');
                  setFilterStatus('all');
                  setFilterTipoTarefa('all');
                  setFilterDateFrom(undefined);
                  setFilterDateTo(undefined);
                  setFilterPrazoFatalFrom(undefined);
                  setFilterPrazoFatalTo(undefined);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma tarefa encontrada com os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Processo</TableHead>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Advogado</TableHead>
                      <TableHead>Data Publicação</TableHead>
                      <TableHead>Prazo Interno</TableHead>
                      <TableHead>Prazo Fatal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map(task => {
                      const vencido = isPrazoVencido(task);
                      return (
                        <TableRow
                          key={task.id}
                          className={cn(
                            task.status === 'completed' && 'opacity-60',
                            vencido && 'bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500'
                          )}
                        >
                          <TableCell className="font-mono text-xs">
                            {task.process_number || <span className="text-muted-foreground italic">Sem número</span>}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm" title={task.title}>
                            {task.title}
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.assigned_users || <span className="text-muted-foreground italic">Sem responsável</span>}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(task.data_publicacao)}</TableCell>
                          <TableCell className="text-sm">{formatDate(task.prazo_interno)}</TableCell>
                          <TableCell className={cn("text-sm font-medium", vencido && "text-red-600 dark:text-red-400 font-bold")}>
                            {formatDate(task.prazo_fatal)}
                          </TableCell>
                          <TableCell>{getVerificacaoBadge(task)}</TableCell>
                          <TableCell className="text-right">
                            {task.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant={task.verificacao ? 'outline' : 'default'}
                                onClick={() => openVerifyDialog(task)}
                              >
                                {task.verificacao ? 'Rever' : 'Verificar'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="p-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Exibindo {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredTasks.length)} de {filteredTasks.length} tarefas (total no banco: {tasks.length})
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage + 1} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Verify Dialog */}
        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verificar Prazo</DialogTitle>
              <DialogDescription>
                {selectedTask?.title} — {selectedTask?.process_number || 'Sem nº processo'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status da verificação</label>
                <Select value={verifyStatus} onValueChange={(v) => setVerifyStatus(v as 'verificado' | 'com_pendencia')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verificado">✅ Verificado — prazo cumprido</SelectItem>
                    <SelectItem value="com_pendencia">⚠️ Com pendência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Anotações sobre a verificação..."
                  value={verifyObservacoes}
                  onChange={(e) => setVerifyObservacoes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleVerify}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
