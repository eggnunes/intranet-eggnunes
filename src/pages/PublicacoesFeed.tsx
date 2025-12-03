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
import { Bell, Search, Calendar, Filter, FileDown, FileText, ListTodo, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, startOfMonth, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';

interface Publication {
  id: string | number;
  date: string;
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

  const openTaskDialog = (publication: Publication) => {
    setSelectedPublication(publication);
    setAiSuggestion(null);
    setSelectedTaskType('');
    setTaskDialogOpen(true);
    // Buscar tipos de tarefa ao abrir o diálogo
    if (taskTypes.length === 0) {
      fetchTaskTypes();
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
        
        // Auto-selecionar tipo de tarefa se sugerido pela IA
        if (data.suggestedTaskTypeId) {
          setSelectedTaskType(String(data.suggestedTaskTypeId));
        } else if (data.suggestedTaskType && taskTypes.length > 0) {
          const matchingType = taskTypes.find(t => 
            t.name.toLowerCase().includes(data.suggestedTaskType.toLowerCase()) ||
            data.suggestedTaskType.toLowerCase().includes(t.name.toLowerCase())
          );
          if (matchingType) {
            setSelectedTaskType(String(matchingType.id));
          }
        }
        
        toast({ title: 'Sugestão gerada', description: 'A IA analisou a publicação e sugeriu uma tarefa.' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível gerar sugestão.', variant: 'destructive' });
    } finally {
      setIsSuggestingTask(false);
    }
  };

  const createTaskFromPublication = async () => {
    if (!selectedPublication) return;

    // Validar tipo de tarefa selecionado
    if (!selectedTaskType) {
      toast({
        title: 'Tipo de tarefa obrigatório',
        description: 'Selecione um tipo de tarefa antes de criar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let lawsuitId = selectedPublication.lawsuit_id;
      let responsibleId: number | null = null;

      // Se já temos o lawsuit_id, buscar diretamente
      if (lawsuitId) {
        try {
          const { data: lawsuitData } = await supabase.functions.invoke('advbox-integration/lawsuit-by-id', {
            body: { lawsuit_id: lawsuitId },
          });
          if (lawsuitData?.data?.responsible_id) {
            responsibleId = lawsuitData.data.responsible_id;
          } else if (lawsuitData?.responsible_id) {
            responsibleId = lawsuitData.responsible_id;
          }
        } catch (err) {
          console.warn('Could not fetch lawsuit details, will use default responsible');
        }
      } else {
        // Fallback: buscar por process_number
        const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke('advbox-integration/lawsuits');
        
        if (lawsuitsError) throw lawsuitsError;

        const apiResponse = lawsuitsData?.data || lawsuitsData;
        const lawsuits = apiResponse?.data || [];
        const processNumber = (selectedPublication.process_number || selectedPublication.lawsuit_number || '').replace(/\D/g, '');
        
        const lawsuit = lawsuits.find((l: any) => {
          const lpn = (l.process_number || '').replace(/\D/g, '');
          return lpn === processNumber;
        });
        
        if (lawsuit) {
          lawsuitId = lawsuit.id;
          responsibleId = lawsuit.responsible_id;
        }
      }

      if (!lawsuitId) {
        toast({
          title: 'Processo não encontrado',
          description: 'Não foi possível localizar o processo para criar a tarefa.',
          variant: 'destructive',
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Usuário não autenticado',
          description: 'Você precisa estar autenticado para criar tarefas.',
          variant: 'destructive',
        });
        return;
      }

      // Garantir formato correto para API Advbox (data sem hora, IDs como inteiros)
      const parsedLawsuitId = parseInt(String(lawsuitId), 10);
      const parsedResponsibleId = responsibleId ? parseInt(String(responsibleId), 10) : 1;
      const parsedTaskTypeId = parseInt(String(selectedTaskType), 10);
      
      const taskData = {
        lawsuits_id: parsedLawsuitId,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        title: aiSuggestion?.taskTitle || `Intimação: ${selectedPublication.title || 'Publicação'}`,
        description: aiSuggestion?.taskDescription || selectedPublication.description || selectedPublication.header || '',
        from: parsedResponsibleId,
        tasks_id: parsedTaskTypeId,
        guests: parsedResponsibleId > 1 ? [parsedResponsibleId] : [],
      };

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
        date: movement.date || movement.created_at,
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

    const headers = ['Data do Evento', 'Número do Processo', 'Título/Descrição', 'Cliente(s)', 'Tribunal'];
    const rows = publications.map(pub => [
      format(new Date(pub.date), 'dd/MM/yyyy', { locale: ptBR }),
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
        page.drawText(`Data do Evento: ${dateText}`, {
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
                                  {publication.created_at && publication.created_at !== publication.date && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Publicado: {format(new Date(publication.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Evento: {format(new Date(publication.date), "dd/MM/yyyy", { locale: ptBR })}
                                  </Badge>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Tarefa a partir da Publicação</DialogTitle>
              <DialogDescription>
                Confirme para criar uma tarefa baseada nesta publicação
              </DialogDescription>
            </DialogHeader>
            {selectedPublication && (
              <div className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-md text-sm space-y-2">
                  <p>
                    <span className="font-medium">Data do Evento:</span>{' '}
                    {format(new Date(selectedPublication.date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p>
                    <span className="font-medium">Processo:</span>{' '}
                    {selectedPublication.process_number || selectedPublication.lawsuit_number || 'Sem número'}
                  </p>
                  <p>
                    <span className="font-medium">Tribunal:</span>{' '}
                    {extractCourtCode(selectedPublication.header)}
                  </p>
                  <p>
                    <span className="font-medium">Título:</span>{' '}
                    {selectedPublication.title || selectedPublication.description || 'Sem título'}
                  </p>
                  {selectedPublication.customers && (
                    <p>
                      <span className="font-medium">Cliente(s):</span> {selectedPublication.customers}
                    </p>
                  )}
                </div>
                
                <Button 
                  onClick={suggestTaskWithAI} 
                  variant="outline" 
                  className="w-full"
                  disabled={isSuggestingTask}
                >
                  {isSuggestingTask ? 'Analisando com IA...' : '✨ Sugerir Tarefa com IA'}
                </Button>
                
                {aiSuggestion && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md text-sm border border-purple-200 dark:border-purple-800">
                    <p className="font-medium text-purple-700 dark:text-purple-300 mb-2">Sugestão da IA:</p>
                    {aiSuggestion.taskTitle && <p><strong>Título:</strong> {aiSuggestion.taskTitle}</p>}
                    {aiSuggestion.suggestedTaskType && <p><strong>Tipo:</strong> {aiSuggestion.suggestedTaskType}</p>}
                    {aiSuggestion.reasoning && <p className="mt-2 text-muted-foreground">{aiSuggestion.reasoning}</p>}
                  </div>
                )}

                {/* Seleção de Tipo de Tarefa */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Tarefa *</label>
                  {loadingTaskTypes ? (
                    <p className="text-sm text-muted-foreground">Carregando tipos...</p>
                  ) : taskTypes.length > 0 ? (
                    <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de tarefa" />
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
                    <p className="text-sm text-muted-foreground">Nenhum tipo de tarefa disponível</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={createTaskFromPublication} className="flex-1" disabled={!selectedTaskType}>
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
