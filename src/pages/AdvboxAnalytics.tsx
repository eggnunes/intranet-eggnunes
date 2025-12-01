import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Users, Briefcase, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface Lawsuit {
  id: number;
  process_number: string;
  type: string;
  group: string;
  responsible: string;
  created_at: string;
  status_closure: string | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AdvboxAnalytics() {
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>([]);
  const [publications, setPublications] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    format: 'pdf' as 'pdf' | 'excel' | 'both',
    includeLawsuits: true,
    includePublications: true,
    includeTasks: true,
    includeFinancial: true,
    scheduleType: '' as '' | 'daily' | 'weekly' | 'monthly',
    email: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const refreshParam = forceRefresh ? '?force_refresh=true' : '';
      
      const [lawsuitsRes, publicationsRes, tasksRes, transactionsRes] = await Promise.all([
        supabase.functions.invoke(`advbox-integration/lawsuits${refreshParam}`),
        supabase.functions.invoke(`advbox-integration/last-movements${refreshParam}`),
        supabase.functions.invoke(`advbox-integration/tasks${refreshParam}`),
        supabase.functions.invoke(`advbox-integration/transactions${refreshParam}`),
      ]);

      // Parse responses properly
      const lawsuitsApiResponse = lawsuitsRes.data?.data || lawsuitsRes.data;
      const publicationsApiResponse = publicationsRes.data?.data || publicationsRes.data;
      const tasksApiResponse = tasksRes.data?.data || tasksRes.data;
      const transactionsApiResponse = transactionsRes.data?.data || transactionsRes.data;

      setLawsuits(lawsuitsApiResponse?.data || []);
      setPublications(publicationsApiResponse?.data || []);
      setTasks(tasksApiResponse?.data || []);
      setTransactions(transactionsApiResponse?.data || []);
      setMetadata(lawsuitsRes.data?.metadata);
      setLastUpdate(new Date());

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'Todos os dados foram recarregados.',
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do Advbox.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for charts
  const lawsuitsByType = lawsuits.reduce((acc, lawsuit) => {
    const type = lawsuit.type || 'Sem tipo';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeChartData = Object.entries(lawsuitsByType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const lawsuitsByResponsible = lawsuits.reduce((acc, lawsuit) => {
    const responsible = lawsuit.responsible || 'Sem responsável';
    acc[responsible] = (acc[responsible] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const responsibleChartData = Object.entries(lawsuitsByResponsible)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const lawsuitsByGroup = lawsuits.reduce((acc, lawsuit) => {
    const group = lawsuit.group || 'Sem grupo';
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const groupChartData = Object.entries(lawsuitsByGroup)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Monthly timeline data
  const monthlyData = lawsuits.reduce((acc, lawsuit) => {
    if (lawsuit.created_at) {
      const month = format(new Date(lawsuit.created_at), 'MMM/yyyy', { locale: ptBR });
      acc[month] = (acc[month] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const timelineData = Object.entries(monthlyData)
    .map(([month, count]) => ({ month, count }))
    .slice(-12);

  const handleExportToPDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const margin = 50;
      let yPosition = height - margin;

      // Title
      page.drawText('Relatório Consolidado Advbox', {
        x: margin,
        y: yPosition,
        size: 20,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 40;

      // Lawsuits section
      if (exportConfig.includeLawsuits && lawsuits.length > 0) {
        page.drawText('PROCESSOS', {
          x: margin,
          y: yPosition,
          size: 16,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;

        page.drawText(`Total de processos ativos: ${lawsuits.length}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 30;

        // Top 5 types
        page.drawText('Top 5 Tipos de Processo:', {
          x: margin,
          y: yPosition,
          size: 12,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;

        typeChartData.slice(0, 5).forEach((item, index) => {
          if (yPosition < 100) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = height - margin;
          }
          page.drawText(`${index + 1}. ${item.name}: ${item.value}`, {
            x: margin + 10,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        });
        yPosition -= 20;
      }

      // Publications section
      if (exportConfig.includePublications && publications.length > 0) {
        if (yPosition < 150) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - margin;
        }

        page.drawText('PUBLICAÇÕES', {
          x: margin,
          y: yPosition,
          size: 16,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;

        page.drawText(`Total de publicações: ${publications.length}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 30;
      }

      // Tasks section
      if (exportConfig.includeTasks && tasks.length > 0) {
        if (yPosition < 150) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - margin;
        }

        page.drawText('TAREFAS', {
          x: margin,
          y: yPosition,
          size: 16,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;

        page.drawText(`Total de tarefas: ${tasks.length}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 30;
      }

      // Financial section
      if (exportConfig.includeFinancial && transactions.length > 0) {
        if (yPosition < 200) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - margin;
        }

        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        const balance = totalIncome - totalExpense;

        page.drawText('FINANCEIRO', {
          x: margin,
          y: yPosition,
          size: 16,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;

        page.drawText(`Receitas: R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0.5, 0),
        });
        yPosition -= 15;

        page.drawText(`Despesas: R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0.8, 0, 0),
        });
        yPosition -= 15;

        page.drawText(`Saldo: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: fontBold,
          color: balance >= 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio_advbox_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.pdf`;
      link.click();

      toast({
        title: 'PDF gerado',
        description: 'O relatório foi exportado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o relatório em PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleExportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Lawsuits sheet
      if (exportConfig.includeLawsuits && lawsuits.length > 0) {
        const lawsuitsData = lawsuits.map(l => ({
          'Número do Processo': l.process_number,
          'Tipo': l.type,
          'Grupo': l.group,
          'Responsável': l.responsible,
          'Data de Criação': l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy') : '',
          'Status': l.status_closure ? 'Encerrado' : 'Ativo',
        }));
        const lawsuitsSheet = XLSX.utils.json_to_sheet(lawsuitsData);
        XLSX.utils.book_append_sheet(workbook, lawsuitsSheet, 'Processos');
      }

      // Publications sheet
      if (exportConfig.includePublications && publications.length > 0) {
        const publicationsData = publications.map(p => ({
          'Data': p.date ? format(new Date(p.date), 'dd/MM/yyyy') : '',
          'Processo': p.process_number || '',
          'Título': p.title || p.header || '',
          'Cliente': p.customers || '',
        }));
        const publicationsSheet = XLSX.utils.json_to_sheet(publicationsData);
        XLSX.utils.book_append_sheet(workbook, publicationsSheet, 'Publicações');
      }

      // Tasks sheet
      if (exportConfig.includeTasks && tasks.length > 0) {
        const tasksData = tasks.map(t => ({
          'Título': t.title || '',
          'Descrição': t.description || '',
          'Vencimento': t.due_date ? format(new Date(t.due_date), 'dd/MM/yyyy') : '',
          'Status': t.status || '',
          'Responsável': t.assigned_to || '',
        }));
        const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
        XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tarefas');
      }

      // Financial sheet
      if (exportConfig.includeFinancial && transactions.length > 0) {
        const transactionsData = transactions.map(t => ({
          'Data': t.date ? format(new Date(t.date), 'dd/MM/yyyy') : '',
          'Descrição': t.description || '',
          'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
          'Categoria': t.category || '',
          'Valor': t.amount || 0,
        }));
        const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Financeiro');
      }

      XLSX.writeFile(workbook, `relatorio_advbox_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`);

      toast({
        title: 'Excel gerado',
        description: 'O relatório foi exportado com sucesso.',
      });
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast({
        title: 'Erro ao gerar Excel',
        description: 'Não foi possível gerar o relatório em Excel.',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    if (exportConfig.format === 'pdf') {
      await handleExportToPDF();
    } else if (exportConfig.format === 'excel') {
      handleExportToExcel();
    } else {
      await handleExportToPDF();
      handleExportToExcel();
    }

    // If schedule is selected, save it
    if (exportConfig.scheduleType && exportConfig.email) {
      try {
        const { error } = await supabase.from('advbox_report_schedules').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          report_type: exportConfig.scheduleType,
          include_lawsuits: exportConfig.includeLawsuits,
          include_publications: exportConfig.includePublications,
          include_tasks: exportConfig.includeTasks,
          include_financial: exportConfig.includeFinancial,
          export_format: exportConfig.format,
          email_recipients: [exportConfig.email],
        });

        if (error) throw error;

        toast({
          title: 'Agendamento criado',
          description: `Relatórios serão enviados ${exportConfig.scheduleType === 'daily' ? 'diariamente' : exportConfig.scheduleType === 'weekly' ? 'semanalmente' : 'mensalmente'} para ${exportConfig.email}`,
        });
      } catch (error) {
        console.error('Error scheduling report:', error);
        toast({
          title: 'Erro ao agendar',
          description: 'Não foi possível criar o agendamento.',
          variant: 'destructive',
        });
      }
    }

    setExportDialogOpen(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando analytics...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              Analytics Advbox
            </h1>
            <p className="text-muted-foreground mt-2">
              Visualize métricas e indicadores dos seus processos
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Relatório
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Exportar Relatório Consolidado</DialogTitle>
                  <DialogDescription>
                    Configure o relatório com os dados do Advbox
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Formato de Exportação</Label>
                    <Select value={exportConfig.format} onValueChange={(value: any) => setExportConfig({ ...exportConfig, format: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="both">Ambos (PDF + Excel)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Incluir Dados:</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="lawsuits"
                          checked={exportConfig.includeLawsuits}
                          onCheckedChange={(checked) => setExportConfig({ ...exportConfig, includeLawsuits: checked as boolean })}
                        />
                        <label htmlFor="lawsuits" className="text-sm cursor-pointer">Processos</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="publications"
                          checked={exportConfig.includePublications}
                          onCheckedChange={(checked) => setExportConfig({ ...exportConfig, includePublications: checked as boolean })}
                        />
                        <label htmlFor="publications" className="text-sm cursor-pointer">Publicações</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tasks"
                          checked={exportConfig.includeTasks}
                          onCheckedChange={(checked) => setExportConfig({ ...exportConfig, includeTasks: checked as boolean })}
                        />
                        <label htmlFor="tasks" className="text-sm cursor-pointer">Tarefas</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="financial"
                          checked={exportConfig.includeFinancial}
                          onCheckedChange={(checked) => setExportConfig({ ...exportConfig, includeFinancial: checked as boolean })}
                        />
                        <label htmlFor="financial" className="text-sm cursor-pointer">Financeiro</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Agendar Envio Automático (Opcional)</Label>
                    <Select value={exportConfig.scheduleType} onValueChange={(value: any) => setExportConfig({ ...exportConfig, scheduleType: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a frequência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Não agendar</SelectItem>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {exportConfig.scheduleType && (
                    <div>
                      <Label>Email para Receber Relatórios</Label>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={exportConfig.email}
                        onChange={(e) => setExportConfig({ ...exportConfig, email: e.target.value })}
                      />
                    </div>
                  )}

                  <Button onClick={handleExport} className="w-full">
                    Exportar{exportConfig.scheduleType && ' e Agendar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lawsuits.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Publicações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Process Types */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Tipos de Processo</CardTitle>
              <CardDescription>Distribuição por tipo de processo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Processes by Responsible */}
          <Card>
            <CardHeader>
              <CardTitle>Processos por Responsável</CardTitle>
              <CardDescription>Distribuição de processos por advogado</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={responsibleChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Processes by Group */}
          <Card>
            <CardHeader>
              <CardTitle>Processos por Grupo</CardTitle>
              <CardDescription>Distribuição por área do direito</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={groupChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {groupChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Processos</CardTitle>
              <CardDescription>Processos criados ao longo do tempo (últimos 12 meses)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} name="Processos" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}