import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Search, Calendar as CalendarIcon, Filter, FileDown, FileText, ListTodo, Eye, EyeOff, CheckCircle2, Sparkles, RefreshCw, Clock, MapPin, Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, startOfMonth, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { cn } from '@/lib/utils';

interface Publication {
  id: string | number;
  date: string; // data de publicação (created_at)
  event_date?: string; // data do evento (date)
  created_at?: string;
  description?: string;
  lawsuit_number?: string;
  court?: string;
  process_number?: string;
  title?: string;
  header?: string;
  customers?: string;
  lawsuit_id?: number;
}

interface ReadPublication {
  lawsuit_id: number;
  movement_date: string;
  movement_title: string;
}

// Extrair código do tribunal do header (ex: "TJMG - Tribunal..." -> "TJMG")
function extractCourtCode(header: string | undefined): string {
  if (!header) return 'Desconhecido';
  const match = header.match(/^([A-Z0-9]+)\s*-/);
  return match ? match[1] : header.split(' ')[0] || 'Desconhecido';
}

export default function PublicacoesFeed() {
  const [lawsuitNumber, setLawsuitNumber] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [allPublications, setAllPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [courtFilter, setCourtFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [readPublications, setReadPublications] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isSuggestingTask, setIsSuggestingTask] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [taskTypes, setTaskTypes] = useState<{ id: string | number; name: string }[]>([]);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(false);
  const [advboxUsers, setAdvboxUsers] = useState<{ id: number; name: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Task form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskProcessNumber, setTaskProcessNumber] = useState('');
  const [taskResponsible, setTaskResponsible] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [taskLocal, setTaskLocal] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState(true);
  
  const { toast } = useToast();

  // Obter ID do usuário logado
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  // Buscar publicações lidas do banco
  useEffect(() => {
    if (userId) {
      fetchReadPublications();
    }
  }, [userId]);

  const fetchReadPublications = async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('publication_reads')
      .select('lawsuit_id, movement_date, movement_title')
      .eq('user_id', userId);

    if (!error && data) {
      const readSet = new Set(
        data.map((r: any) => `${r.lawsuit_id}-${r.movement_date}-${r.movement_title}`)
      );
      setReadPublications(readSet);
    }
  };

  const getPublicationKey = (pub: Publication): string => {
    return `${pub.lawsuit_id || 0}-${pub.date}-${pub.title || ''}`;
  };

  const isPublicationRead = (pub: Publication): boolean => {
    return readPublications.has(getPublicationKey(pub));
  };

  const toggleReadStatus = async (pub: Publication, markAsRead: boolean) => {
    if (!userId) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar autenticado.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (markAsRead) {
        const { error } = await supabase
          .from('publication_reads')
          .insert({
            user_id: userId,
            lawsuit_id: pub.lawsuit_id || 0,
            movement_date: pub.date,
            movement_title: pub.title || '',
          });

        if (error) throw error;

        setReadPublications(prev => new Set([...prev, getPublicationKey(pub)]));
        toast({
          title: 'Marcado como lido',
          description: 'Publicação marcada como lida.',
        });
      } else {
        const { error } = await supabase
          .from('publication_reads')
          .delete()
          .eq('user_id', userId)
          .eq('lawsuit_id', pub.lawsuit_id || 0)
          .eq('movement_date', pub.date)
          .eq('movement_title', pub.title || '');

        if (error) throw error;

        setReadPublications(prev => {
          const newSet = new Set(prev);
          newSet.delete(getPublicationKey(pub));
          return newSet;
        });
        toast({
          title: 'Marcado como não lido',
          description: 'Publicação marcada como não lida.',
        });
      }
    } catch (error) {
      console.error('Error toggling read status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status de leitura.',
        variant: 'destructive',
      });
    }
  };

  const markAllAsRead = async () => {
    if (!userId || publications.length === 0) return;

    try {
      const unreadPubs = publications.filter(pub => !isPublicationRead(pub));
      
      if (unreadPubs.length === 0) {
        toast({
          title: 'Nenhuma publicação',
          description: 'Todas as publicações já estão marcadas como lidas.',
        });
        return;
      }

      const records = unreadPubs.map(pub => ({
        user_id: userId,
        lawsuit_id: pub.lawsuit_id || 0,
        movement_date: pub.date,
        movement_title: pub.title || '',
      }));

      const { error } = await supabase
        .from('publication_reads')
        .upsert(records, { onConflict: 'user_id,lawsuit_id,movement_date,movement_title' });

      if (error) throw error;

      const newReadSet = new Set(readPublications);
      unreadPubs.forEach(pub => newReadSet.add(getPublicationKey(pub)));
      setReadPublications(newReadSet);

      toast({
        title: 'Publicações marcadas',
        description: `${unreadPubs.length} publicações marcadas como lidas.`,
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar todas como lidas.',
        variant: 'destructive',
      });
    }
  };

  const openTaskDialog = async (publication: Publication) => {
    setSelectedPublication(publication);
    setAiSuggestion(null);
    setSelectedTaskType('');
    setTaskTitle(`Intimação: ${publication.title || 'Publicação'}`);
    setTaskDescription(publication.header || publication.description || '');
    setTaskProcessNumber(publication.process_number || publication.lawsuit_number || '');
    setTaskNotes('');
    setTaskResponsible('');
    setSelectedGuests([]);
    setStartDate(new Date());
    setStartTime('09:00');
    setEndDate(undefined);
    setEndTime('');
    setDeadlineDate(undefined);
    setTaskLocal('');
    setIsUrgent(false);
    setIsImportant(false);
    setDisplaySchedule(true);
    setTaskDialogOpen(true);
    
    // Buscar tipos de tarefa ao abrir o diálogo
    if (taskTypes.length === 0) {
      fetchTaskTypes();
    }
    
    // Buscar usuários do Advbox
    if (advboxUsers.length === 0) {
      fetchAdvboxUsers();
    }
    
    // Buscar responsável do processo
    if (publication.lawsuit_id) {
      try {
        const { data: lawsuitData } = await supabase.functions.invoke('advbox-integration/lawsuit-by-id', {
          body: { lawsuit_id: publication.lawsuit_id },
        });
        const responsibleId = lawsuitData?.data?.responsible_id || lawsuitData?.responsible_id;
        if (responsibleId) {
          setTaskResponsible(String(responsibleId));
          setSelectedGuests([parseInt(String(responsibleId), 10)]);
        }
      } catch (err) {
        console.warn('Could not fetch lawsuit responsible');
      }
    }
  };
  
  const toggleGuest = (userId: number) => {
    setSelectedGuests(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  const fetchAdvboxUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/users');
      if (error) throw error;
      
      const rawData = data?.data || data?.users || [];
      const users = Array.isArray(rawData) ? rawData.map((u: any) => ({
        id: u.id || u.user_id,
        name: u.name || u.full_name || u.email || `Usuário ${u.id}`,
      })).filter((u: any) => u.id) : [];
      
      setAdvboxUsers(users);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchTaskTypes = async () => {
    setLoadingTaskTypes(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/task-types');
      if (error) throw error;
      
      const rawData = data?.data || [];
      const types = Array.isArray(rawData) ? rawData.map((t: any) => ({
        id: t.id || t.tasks_id,
        name: t.task || t.name || t.title || `Tipo ${t.id || t.tasks_id}`,
      })).filter((t: any) => t.id && t.name) : [];
      
      setTaskTypes(types);
    } catch (err) {
      console.error('Erro ao buscar tipos de tarefa:', err);
    } finally {
      setLoadingTaskTypes(false);
    }
  };

  const suggestTaskWithAI = async () => {
    if (!selectedPublication) return;
    
    setIsSuggestingTask(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-task', {
        body: {
          publicationContent: selectedPublication.title || selectedPublication.header || selectedPublication.description || '',
          processNumber: selectedPublication.process_number || selectedPublication.lawsuit_number,
          customerName: selectedPublication.customers,
          court: extractCourtCode(selectedPublication.header),
          taskTypes: taskTypes.map(t => ({ id: t.id, name: t.name })),
        },
      });

      if (error) throw error;
      if (data && !data.error) {
        setAiSuggestion(data);
        toast({ title: 'Sugestão gerada', description: 'Clique em "Aplicar Sugestão" para preencher os campos automaticamente.' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível gerar sugestão.', variant: 'destructive' });
    } finally {
      setIsSuggestingTask(false);
    }
  };
  
  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    
    // Aplicar sugestão aos campos do formulário
    if (aiSuggestion.taskTitle) {
      setTaskTitle(aiSuggestion.taskTitle);
    }
    if (aiSuggestion.taskDescription) {
      setTaskDescription(aiSuggestion.taskDescription);
    }
    if (aiSuggestion.suggestedTaskTypeId) {
      setSelectedTaskType(String(aiSuggestion.suggestedTaskTypeId));
    } else if (aiSuggestion.suggestedTaskType && taskTypes.length > 0) {
      const matchingType = taskTypes.find(t => 
        t.name.toLowerCase().includes(aiSuggestion.suggestedTaskType.toLowerCase()) ||
        aiSuggestion.suggestedTaskType.toLowerCase().includes(t.name.toLowerCase())
      );
      if (matchingType) {
        setSelectedTaskType(String(matchingType.id));
      }
    }
    if (aiSuggestion.suggestedDeadline) {
      try {
        setDeadlineDate(parseISO(aiSuggestion.suggestedDeadline));
      } catch (e) {
        console.warn('Could not parse deadline date');
      }
    }
    if (aiSuggestion.reasoning) {
      setTaskNotes(aiSuggestion.reasoning);
    }
    
    toast({ title: 'Sugestão aplicada', description: 'Os campos foram preenchidos com a sugestão da IA.' });
  };

  const createTaskFromPublication = async () => {
    if (!selectedPublication) return;

    // Validar campos obrigatórios
    if (!taskTitle.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título da tarefa.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTaskType) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria antes de criar.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingTask(true);
    
    try {
      let lawsuitId = selectedPublication.lawsuit_id;

      // Se não temos lawsuit_id, buscar por process_number
      if (!lawsuitId) {
        const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke('advbox-integration/lawsuits');
        
        if (lawsuitsError) throw lawsuitsError;

        const apiResponse = lawsuitsData?.data || lawsuitsData;
        const lawsuits = apiResponse?.data || [];
        const processNumber = (taskProcessNumber || '').replace(/\D/g, '');
        
        const lawsuit = lawsuits.find((l: any) => {
          const lpn = (l.process_number || '').replace(/\D/g, '');
          return lpn === processNumber;
        });
        
        if (lawsuit) {
          lawsuitId = lawsuit.id;
        }
      }

      if (!lawsuitId) {
        toast({
          title: 'Processo não encontrado',
          description: 'Não foi possível localizar o processo para criar a tarefa.',
          variant: 'destructive',
        });
        setIsCreatingTask(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Usuário não autenticado',
          description: 'Você precisa estar autenticado para criar tarefas.',
          variant: 'destructive',
        });
        setIsCreatingTask(false);
        return;
      }

      // Garantir formato correto para API Advbox
      const parsedLawsuitId = parseInt(String(lawsuitId), 10);
      const parsedResponsibleId = taskResponsible ? parseInt(String(taskResponsible), 10) : 1;
      const parsedTaskTypeId = parseInt(String(selectedTaskType), 10);
      const parsedGuests = selectedGuests.length > 0 
        ? selectedGuests.map(g => parseInt(String(g), 10))
        : [parsedResponsibleId];
      
      const taskData: Record<string, any> = {
        lawsuits_id: parsedLawsuitId,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        comments: `${taskTitle}\n\n${taskDescription}${taskNotes ? '\n\nObservações: ' + taskNotes : ''}`,
        from: parsedResponsibleId,
        tasks_id: parsedTaskTypeId,
        guests: parsedGuests,
      };
      
      // Optional fields
      if (startTime) taskData.start_time = startTime;
      if (endDate) taskData.end_date = format(endDate, 'yyyy-MM-dd');
      if (endTime) taskData.end_time = endTime;
      if (deadlineDate) taskData.date_deadline = format(deadlineDate, 'yyyy-MM-dd');
      if (taskLocal) taskData.local = taskLocal;
      if (isUrgent) taskData.urgent = 1;
      if (isImportant) taskData.important = 1;
      taskData.display_schedule = displaySchedule ? 1 : 0;

      const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: taskData,
      });

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'Tarefa criada com sucesso a partir da publicação.',
      });

      setTaskDialogOpen(false);
      setSelectedPublication(null);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Extrair tipos de movimento e tribunais únicos
  const movementTypes = useMemo(() => 
    Array.from(new Set(allPublications.map(pub => pub.title).filter(Boolean))).sort(),
    [allPublications]
  );

  const courts = useMemo(() => 
    Array.from(new Set(allPublications.map(pub => extractCourtCode(pub.header)))).sort(),
    [allPublications]
  );

  // Buscar publicações recentes ao carregar a página
  useEffect(() => {
    fetchRecentPublications();
  }, []);

  const fetchRecentPublications = async (forceRefresh = false) => {
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/last-movements', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      const allPubs = Array.isArray(data?.data) ? data.data : [];
      setMetadata(data?.metadata);
      setLastUpdate(new Date());
      
      console.log(`Fetched ${allPubs.length} movements from API`);
      
      const mappedPubs: Publication[] = allPubs.map((movement: any, index: number) => ({
        id: movement.id ?? `${movement.lawsuit_id ?? 'movement'}-${movement.date ?? movement.created_at}-${index}`,
        date: movement.created_at || movement.date, // Data de publicação (created_at como prioridade)
        event_date: movement.date, // Data do evento
        created_at: movement.created_at,
        process_number: movement.process_number,
        title: movement.title,
        header: movement.header,
        customers: movement.customers,
        lawsuit_id: movement.lawsuit_id,
      }));

      setAllPublications(mappedPubs);
      applyFilters(mappedPubs);

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: `${mappedPubs.length} publicações carregadas.`,
        });
      }
    } catch (error) {
      console.error('Error fetching recent publications:', error);
      toast({
        title: 'Erro ao buscar publicações',
        description: 'Não foi possível buscar as publicações recentes.',
        variant: 'destructive',
      });
    } finally {
      setLoadingRecent(false);
    }
  };

  const applyFilters = (pubs: Publication[]) => {
    let filtered = [...pubs];

    // Filtro de período
    if (periodFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (periodFilter) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        default:
          startDate = subDays(now, 365);
      }

      filtered = filtered.filter((pub) => {
        try {
          const pubDate = parseISO(pub.date);
          return isAfter(pubDate, startDate);
        } catch {
          return true;
        }
      });
    }

    // Filtro de tipo de movimento
    if (movementTypeFilter !== 'all') {
      filtered = filtered.filter(pub => pub.title === movementTypeFilter);
    }

    // Filtro de tribunal
    if (courtFilter !== 'all') {
      filtered = filtered.filter(pub => extractCourtCode(pub.header) === courtFilter);
    }

    // Filtro de lido/não lido
    if (readFilter === 'read') {
      filtered = filtered.filter(pub => isPublicationRead(pub));
    } else if (readFilter === 'unread') {
      filtered = filtered.filter(pub => !isPublicationRead(pub));
    }

    setPublications(filtered);
  };

  // Reaplicar filtros quando os valores mudarem
  useEffect(() => {
    if (allPublications.length > 0) {
      applyFilters(allPublications);
    }
  }, [periodFilter, movementTypeFilter, courtFilter, readFilter, readPublications]);

  const handleSearch = async () => {
    if (!lawsuitNumber.trim()) {
      applyFilters(allPublications);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/publications', {
        body: { lawsuit_id: lawsuitNumber.trim() },
      });

      if (error) throw error;

      const rawPubs = (data as any[]) || [];
      const mappedPubs: Publication[] = rawPubs.map((pub: any) => ({
        id: pub.id,
        date: pub.date,
        description: pub.description,
        lawsuit_number: pub.lawsuit_number,
        court: pub.court,
      }));

      setPublications(mappedPubs);
      
      if (!data || data.length === 0) {
        toast({
          title: 'Nenhuma publicação encontrada',
          description: 'Não há publicações para este processo.',
        });
      }
    } catch (error) {
      console.error('Error fetching publications:', error);
      toast({
        title: 'Erro ao buscar publicações',
        description: 'Não foi possível buscar as publicações. Verifique o número do processo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setLawsuitNumber('');
    applyFilters(allPublications);
  };

  const exportToCSV = () => {
    if (publications.length === 0) {
      toast({
        title: 'Nenhuma publicação para exportar',
        description: 'Não há publicações com os filtros selecionados.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Data Publicação', 'Data Evento', 'Número do Processo', 'Título/Descrição', 'Cliente(s)', 'Tribunal'];
    const rows = publications.map(pub => [
      format(new Date(pub.date), 'dd/MM/yyyy', { locale: ptBR }),
      pub.event_date ? format(new Date(pub.event_date), 'dd/MM/yyyy', { locale: ptBR }) : '',
      pub.lawsuit_number || pub.process_number || 'Sem número',
      pub.description || pub.title || pub.header || '',
      pub.customers || '',
      extractCourtCode(pub.header),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `publicacoes_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Exportação concluída',
      description: `${publications.length} publicações exportadas para CSV.`,
    });
  };

  const exportToPDF = async () => {
    if (publications.length === 0) {
      toast({
        title: 'Nenhuma publicação para exportar',
        description: 'Não há publicações com os filtros selecionados.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const margin = 50;
      let yPosition = height - margin;

      page.drawText('Feed de Publicações', {
        x: margin,
        y: yPosition,
        size: 20,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;

      page.drawText(`Total: ${publications.length} publicações`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 30;

      for (const pub of publications) {
        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - margin;
        }

        const dateText = format(new Date(pub.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        page.drawText(`Data de Publicação: ${dateText}`, {
          x: margin,
          y: yPosition,
          size: 10,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        const processNumber = pub.lawsuit_number || pub.process_number || 'Sem número';
        page.drawText(`Processo: ${processNumber}`, {
          x: margin,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        if (pub.description || pub.title || pub.header) {
          const titleText = pub.description || pub.title || pub.header || '';
          const maxWidth = width - (margin * 2);
          const words = titleText.split(' ');
          let line = '';
          
          for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = font.widthOfTextAtSize(testLine, 9);
            
            if (testWidth > maxWidth && line.length > 0) {
              page.drawText(line.trim(), {
                x: margin,
                y: yPosition,
                size: 9,
                font: font,
                color: rgb(0, 0, 0),
              });
              line = word + ' ';
              yPosition -= 12;
              
              if (yPosition < 100) {
                page = pdfDoc.addPage([595, 842]);
                yPosition = height - margin;
              }
            } else {
              line = testLine;
            }
          }
          
          if (line.trim().length > 0) {
            page.drawText(line.trim(), {
              x: margin,
              y: yPosition,
              size: 9,
              font: font,
              color: rgb(0, 0, 0),
            });
            yPosition -= 15;
          }
        }

        if (pub.customers) {
          page.drawText(`Cliente(s): ${pub.customers}`, {
            x: margin,
            y: yPosition,
            size: 9,
            font: font,
            color: rgb(0.4, 0.4, 0.4),
          });
          yPosition -= 12;
        }

        page.drawText(`Tribunal: ${extractCourtCode(pub.header)}`, {
          x: margin,
          y: yPosition,
          size: 8,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 20;

        page.drawLine({
          start: { x: margin, y: yPosition },
          end: { x: width - margin, y: yPosition },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yPosition -= 15;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `publicacoes_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.pdf`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Exportação concluída',
        description: `${publications.length} publicações exportadas para PDF.`,
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o PDF.',
        variant: 'destructive',
      });
    }
  };

  const unreadCount = publications.filter(pub => !isPublicationRead(pub)).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary" />
              Feed de Publicações
            </h1>
            <p className="text-muted-foreground mt-2">
              Movimentações recentes do Advbox
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={markAllAsRead} variant="outline" size="sm" disabled={unreadCount === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar todas como lidas ({unreadCount})
            </Button>
          </div>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Busca e Filtros */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Buscar por Processo Específico
              </CardTitle>
              <CardDescription>
                Informe um número de processo para buscar suas publicações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Número do processo (opcional)"
                  value={lawsuitNumber}
                  onChange={(e) => setLawsuitNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>
                {lawsuitNumber && (
                  <Button onClick={handleClearSearch} variant="outline">
                    Limpar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <CardDescription>
                Refine as publicações por período, tipo, tribunal e status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última Semana</SelectItem>
                      <SelectItem value="month">Último Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tribunal</label>
                  <Select value={courtFilter} onValueChange={setCourtFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {courts.map((court) => (
                        <SelectItem key={court} value={court}>
                          {court}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Movimento</label>
                  <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {movementTypes.map((type) => (
                        <SelectItem key={type} value={type!}>
                          {type!.substring(0, 50)}{type!.length > 50 ? '...' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status de Leitura</label>
                  <Select value={readFilter} onValueChange={setReadFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unread">Não lidas</SelectItem>
                      <SelectItem value="read">Lidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Publicações */}
        {loadingRecent ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : publications.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {lawsuitNumber ? 'Publicações do Processo' : 'Publicações Recentes'}
                  </CardTitle>
                  <CardDescription>
                    {publications.length} {publications.length === 1 ? 'publicação encontrada' : 'publicações encontradas'}
                    {unreadCount > 0 && ` (${unreadCount} não lida${unreadCount > 1 ? 's' : ''})`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button onClick={exportToPDF} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {publications.map((publication) => {
                    const isRead = isPublicationRead(publication);
                    return (
                      <Card 
                        key={publication.id} 
                        className={`hover:shadow-md transition-shadow ${isRead ? 'opacity-60 bg-muted/30' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 flex items-center gap-3">
                              <Checkbox
                                checked={isRead}
                                onCheckedChange={(checked) => toggleReadStatus(publication, !!checked)}
                                className="mt-1"
                              />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50 dark:bg-blue-900/20">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Publicado: {format(new Date(publication.date), "dd/MM/yyyy", { locale: ptBR })}
                                  </Badge>
                                  {publication.event_date && (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Evento: {format(new Date(publication.event_date), "dd/MM/yyyy", { locale: ptBR })}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {extractCourtCode(publication.header)}
                                  </Badge>
                                  {isRead && (
                                    <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Lida
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge>
                                {publication.lawsuit_number || publication.process_number || 'Sem número'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleReadStatus(publication, !isRead)}
                                title={isRead ? 'Marcar como não lida' : 'Marcar como lida'}
                              >
                                {isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openTaskDialog(publication)}
                              >
                                <ListTodo className="h-4 w-4 mr-2" />
                                Criar Tarefa
                              </Button>
                            </div>
                          </div>
                          {(publication.description || publication.title || publication.header) && (
                            <p className="text-sm font-semibold mb-2 ml-8">
                              {publication.description || publication.title || publication.header}
                            </p>
                          )}
                          {publication.customers && (
                            <p className="text-sm text-muted-foreground mb-2 ml-8">
                              <span className="font-medium">Cliente(s):</span> {publication.customers}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma publicação encontrada com os filtros selecionados
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dialog de Criação de Tarefa */}
        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Tarefa</DialogTitle>
              <DialogDescription>
                Preencha os campos abaixo para criar uma nova tarefa no Advbox
              </DialogDescription>
            </DialogHeader>
            {selectedPublication && (
              <div className="space-y-4">
                {/* AI Suggestion Button */}
                <Button 
                  onClick={suggestTaskWithAI} 
                  variant="outline" 
                  className="w-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-500/30"
                  disabled={isSuggestingTask}
                >
                  {isSuggestingTask ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analisando com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                      Sugerir Tarefa com IA
                    </>
                  )}
                </Button>
                
                {aiSuggestion && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md text-sm border border-purple-200 dark:border-purple-800 space-y-2">
                    <p className="font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Sugestão da IA:
                    </p>
                    {aiSuggestion.taskTitle && <p><strong>Título:</strong> {aiSuggestion.taskTitle}</p>}
                    {aiSuggestion.suggestedTaskType && <p><strong>Tipo:</strong> {aiSuggestion.suggestedTaskType}</p>}
                    {aiSuggestion.suggestedDeadline && <p><strong>Prazo:</strong> {format(parseISO(aiSuggestion.suggestedDeadline), 'dd/MM/yyyy')}</p>}
                    {aiSuggestion.reasoning && <p className="text-muted-foreground text-xs">{aiSuggestion.reasoning}</p>}
                    <Button 
                      onClick={applyAISuggestion} 
                      size="sm" 
                      className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aplicar Sugestão
                    </Button>
                  </div>
                )}

                {/* Título */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Título *</Label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Título da tarefa"
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Descrição</Label>
                  <Textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Descrição da tarefa"
                    rows={3}
                  />
                </div>

                {/* Número do Processo */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Número do Processo</Label>
                  <Input
                    value={taskProcessNumber}
                    onChange={(e) => setTaskProcessNumber(e.target.value)}
                    placeholder="Ex: 1234567-89.2023.8.26.0100"
                    disabled
                  />
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Categoria *</Label>
                  {loadingTaskTypes ? (
                    <p className="text-sm text-muted-foreground">Carregando categorias...</p>
                  ) : taskTypes.length > 0 ? (
                    <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria disponível</p>
                  )}
                </div>

                {/* Responsável */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Responsável (Criador)</Label>
                  {loadingUsers ? (
                    <p className="text-sm text-muted-foreground">Carregando responsáveis...</p>
                  ) : advboxUsers.length > 0 ? (
                    <Select value={taskResponsible} onValueChange={setTaskResponsible}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {advboxUsers.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={taskResponsible}
                      onChange={(e) => setTaskResponsible(e.target.value)}
                      placeholder="ID do responsável"
                    />
                  )}
                </div>

                {/* Participantes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Participantes
                  </Label>
                  {advboxUsers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedGuests.map(guestId => {
                          const user = advboxUsers.find(u => u.id === guestId);
                          return (
                            <Badge key={guestId} variant="secondary" className="gap-1">
                              {user?.name || `ID: ${guestId}`}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => toggleGuest(guestId)}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                      <ScrollArea className="h-24 border rounded-md p-2">
                        <div className="space-y-2">
                          {advboxUsers.map((user) => (
                            <div key={user.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`guest-pub-${user.id}`}
                                checked={selectedGuests.includes(user.id)}
                                onCheckedChange={() => toggleGuest(user.id)}
                              />
                              <label htmlFor={`guest-pub-${user.id}`} className="text-sm cursor-pointer">
                                {user.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Os participantes serão definidos automaticamente.
                    </p>
                  )}
                </div>

                {/* Data e Hora de Início */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Data *
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Hora
                    </Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Data e Hora de Término */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data Término</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          {endDate ? format(endDate, "dd/MM/yyyy") : "Opcional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Hora Término</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>

                {/* Prazo Fatal */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-destructive flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Prazo Fatal
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !deadlineDate && "text-muted-foreground"
                        )}
                      >
                        {deadlineDate ? format(deadlineDate, "dd/MM/yyyy") : "Selecionar prazo fatal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadlineDate}
                        onSelect={setDeadlineDate}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Local */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Local do Evento
                  </Label>
                  <Input
                    value={taskLocal}
                    onChange={(e) => setTaskLocal(e.target.value)}
                    placeholder="Ex: Sala de reuniões, Fórum, etc."
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observações</Label>
                  <Textarea
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    placeholder="Observações adicionais"
                    rows={2}
                  />
                </div>

                {/* Flags: Urgente, Importante, Mostrar na Agenda */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Opções</Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="urgent-pub"
                        checked={isUrgent}
                        onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
                      />
                      <label htmlFor="urgent-pub" className="text-sm cursor-pointer font-medium text-orange-600">
                        Urgente
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="important-pub"
                        checked={isImportant}
                        onCheckedChange={(checked) => setIsImportant(checked as boolean)}
                      />
                      <label htmlFor="important-pub" className="text-sm cursor-pointer font-medium text-blue-600">
                        Importante
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="display_schedule-pub"
                        checked={displaySchedule}
                        onCheckedChange={(checked) => setDisplaySchedule(checked as boolean)}
                      />
                      <label htmlFor="display_schedule-pub" className="text-sm cursor-pointer">
                        Mostrar na Agenda
                      </label>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={createTaskFromPublication} 
                  className="w-full" 
                  disabled={!taskTitle || !selectedTaskType || isCreatingTask}
                >
                  {isCreatingTask ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Tarefa'
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
