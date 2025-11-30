import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, Search, Calendar, Filter, FileDown, FileText, ListTodo } from 'lucide-react';
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
  description?: string;
  lawsuit_number?: string;
  court?: string;
  process_number?: string;
  title?: string;
  header?: string;
  customers?: string;
}

export default function PublicacoesFeed() {
  const [lawsuitNumber, setLawsuitNumber] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [allPublications, setAllPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('week');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const { toast } = useToast();

  const openTaskDialog = (publication: Publication) => {
    setSelectedPublication(publication);
    setTaskDialogOpen(true);
  };

  const createTaskFromPublication = async () => {
    if (!selectedPublication) return;

    try {
      // Buscar todos os processos para encontrar o ID
      const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke('advbox-integration/lawsuits');
      
      if (lawsuitsError) throw lawsuitsError;

      const lawsuits = lawsuitsData?.data || [];
      const processNumber = selectedPublication.process_number || selectedPublication.lawsuit_number || '';
      
      // Buscar o processo correspondente
      const lawsuit = lawsuits.find((l: any) => l.process_number === processNumber);
      
      if (!lawsuit) {
        toast({
          title: 'Processo não encontrado',
          description: 'Não foi possível localizar o processo para criar a tarefa.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
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
        lawsuits_id: lawsuit.id,
        start_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        title: `Intimação: ${selectedPublication.title || 'Publicação'}`,
        description: selectedPublication.description || selectedPublication.header || '',
        from: lawsuit.responsible_id, // ID do responsável pelo processo
        tasks_id: 1, // ID padrão do tipo de tarefa
        guests: [lawsuit.responsible_id], // Atribuir ao responsável do processo
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

  // Extract unique movement types from all publications
  const movementTypes = Array.from(
    new Set(allPublications.map(pub => pub.title).filter(Boolean))
  ).sort();

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

      const allPubs = data?.data || [];
      setMetadata(data?.metadata);
      setLastUpdate(new Date());
      
      const mappedPubs: Publication[] = allPubs.map((movement: any, index: number) => ({
        id: movement.id ?? `${movement.lawsuit_id ?? 'movement'}-${movement.date ?? movement.created_at}-${index}`,
        date: movement.date || movement.created_at,
        process_number: movement.process_number,
        title: movement.title,
        header: movement.header,
        customers: movement.customers,
      }));

      setAllPublications(mappedPubs);
      applyFilters(mappedPubs);

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'As publicações foram recarregadas.',
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

    // Apply period filter
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
        startDate = subDays(now, 7);
    }

    filtered = filtered.filter((pub) => {
      try {
        const pubDate = parseISO(pub.date);
        return isAfter(pubDate, startDate);
      } catch {
        return false;
      }
    });

    // Apply movement type filter
    if (movementTypeFilter !== 'all') {
      filtered = filtered.filter(pub => pub.title === movementTypeFilter);
    }

    setPublications(filtered);

    if (filtered.length === 0) {
      toast({
        title: 'Nenhuma publicação encontrada',
        description: 'Não há publicações com os filtros selecionados.',
      });
    }
  };

  // Re-apply filters when filter values change
  useEffect(() => {
    if (allPublications.length > 0) {
      applyFilters(allPublications);
    }
  }, [periodFilter, movementTypeFilter]);

  const handleSearch = async () => {
    if (!lawsuitNumber.trim()) {
      // Se não tem número de processo, volta para as publicações recentes
      setPublications(allPublications);
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

    const headers = ['Data', 'Número do Processo', 'Título/Descrição', 'Cliente(s)', 'Tribunal'];
    const rows = publications.map(pub => [
      format(new Date(pub.date), 'dd/MM/yyyy', { locale: ptBR }),
      pub.lawsuit_number || pub.process_number || 'Sem número',
      pub.description || pub.title || pub.header || '',
      pub.customers || '',
      pub.court || pub.header || '',
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
      
      let page = pdfDoc.addPage([595, 842]); // A4 size
      const { width, height } = page.getSize();
      const margin = 50;
      let yPosition = height - margin;

      // Title
      page.drawText('Feed de Publicações', {
        x: margin,
        y: yPosition,
        size: 20,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;

      // Subtitle
      const periodText = periodFilter === 'today' ? 'Hoje' : 
                        periodFilter === 'week' ? 'Última Semana' : 'Último Mês';
      page.drawText(`Período: ${periodText} | Total: ${publications.length} publicações`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 30;

      // Publications
      for (const pub of publications) {
        // Check if we need a new page
        if (yPosition < 100) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - margin;
        }

        // Date
        const dateText = format(new Date(pub.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        page.drawText(dateText, {
          x: margin,
          y: yPosition,
          size: 10,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        // Process number
        const processNumber = pub.lawsuit_number || pub.process_number || 'Sem número';
        page.drawText(`Processo: ${processNumber}`, {
          x: margin,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        // Title/Description
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

        // Clients
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

        // Court
        if (pub.court || pub.header) {
          page.drawText(pub.court || pub.header || '', {
            x: margin,
            y: yPosition,
            size: 8,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          });
          yPosition -= 20;
        } else {
          yPosition -= 10;
        }

        // Separator line
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
              Publicações recentes do Advbox
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
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
                Refine as publicações por período e tipo de movimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última Semana</SelectItem>
                      <SelectItem value="month">Último Mês</SelectItem>
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
                          {type}
                        </SelectItem>
                      ))}
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
                  {publications.map((publication) => (
                    <Card key={publication.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <Badge variant="outline">
                              {format(new Date(publication.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>
                              {publication.lawsuit_number || publication.process_number || 'Sem número'}
                            </Badge>
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
                          <p className="text-sm font-semibold mb-2">
                            {publication.description || publication.title || publication.header}
                          </p>
                        )}
                        {publication.customers && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">Cliente(s):</span> {publication.customers}
                          </p>
                        )}
                        {(publication.court || publication.header) && (
                          <p className="text-xs text-muted-foreground">
                            {publication.court || publication.header}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
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
                    <span className="font-medium">Data:</span>{' '}
                    {format(new Date(selectedPublication.date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p>
                    <span className="font-medium">Processo:</span>{' '}
                    {selectedPublication.process_number || selectedPublication.lawsuit_number || 'Sem número'}
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
                <div className="flex gap-2">
                  <Button onClick={createTaskFromPublication} className="flex-1">
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

