
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  CalendarIcon, TrendingUp, DollarSign, Users, MousePointerClick, Eye, Target,
  Plus, Pencil, Trash2, Megaphone, BarChart3, Filter, Facebook
} from 'lucide-react';
import MetaAdsTab from '@/components/marketing/MetaAdsTab';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { tutorialsByPage } from '@/components/tutorialData';

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', color: 'hsl(var(--primary))' },
  { value: 'instagram', label: 'Instagram', color: 'hsl(var(--destructive))' },
  { value: 'linkedin', label: 'LinkedIn', color: 'hsl(var(--accent-foreground))' },
  { value: 'google', label: 'Google Ads', color: 'hsl(var(--secondary-foreground))' },
  { value: 'tiktok', label: 'TikTok', color: 'hsl(var(--muted-foreground))' },
];

const PIE_COLORS = ['hsl(215, 80%, 55%)', 'hsl(340, 75%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(45, 90%, 50%)', 'hsl(280, 60%, 55%)'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function MarketingHub() {
  const { profile } = useUserRole();
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState('30');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [pubDialogOpen, setPubDialogOpen] = useState(false);
  const [editingPub, setEditingPub] = useState<any>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const dateRange = useMemo(() => {
    if (periodDays === 'custom' && customRange.from && customRange.to) {
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
    }
    const days = parseInt(periodDays) || 30;
    return { from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) };
  }, [periodDays, customRange]);

  // Queries
  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-campaigns', dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_campaigns')
        .select('*')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: publications = [], refetch: refetchPubs } = useQuery({
    queryKey: ['marketing-publications', calendarMonth],
    queryFn: async () => {
      const start = startOfMonth(calendarMonth);
      const end = endOfMonth(calendarMonth);
      const { data } = await (supabase
        .from('marketing_publications' as any))
        .select('*')
        .gte('scheduled_date', start.toISOString())
        .lte('scheduled_date', end.toISOString())
        .order('scheduled_date');
      return data || [];
    },
  });

  const { data: dealStages = [] } = useQuery({
    queryKey: ['marketing-funnel-stages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deal_stages')
        .select('*')
        .order('order_index');
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['marketing-funnel-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, stage_id, value, won');
      return data || [];
    },
  });

  // Meta Ads insights for ROI tab
  const metaDateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const metaDateTo = format(dateRange.to, 'yyyy-MM-dd');

  const { data: metaInsights = [] } = useQuery({
    queryKey: ['marketing-roi-insights', metaDateFrom, metaDateTo],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return [];
      const resp = await supabase.functions.invoke('meta-ads', {
        body: { action: 'insights', date_from: metaDateFrom, date_to: metaDateTo },
      });
      return resp.data?.insights || [];
    },
  });

  const { data: metaDailyInsights = [] } = useQuery({
    queryKey: ['marketing-roi-daily', metaDateFrom, metaDateTo],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return [];
      const resp = await supabase.functions.invoke('meta-ads', {
        body: { action: 'daily_insights', date_from: metaDateFrom, date_to: metaDateTo },
      });
      return resp.data?.daily || [];
    },
  });

  // Publication mutations
  const savePub = useMutation({
    mutationFn: async (pub: any) => {
      if (pub.id) {
        const { error } = await supabase.from('marketing_publications' as any).update({
          title: pub.title, description: pub.description, platform: pub.platform,
          scheduled_date: pub.scheduled_date, status: pub.status,
        }).eq('id', pub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_publications' as any).insert({
          title: pub.title, description: pub.description, platform: pub.platform,
          scheduled_date: pub.scheduled_date, status: pub.status, created_by: profile?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Publicação salva!');
      setPubDialogOpen(false);
      setEditingPub(null);
      refetchPubs();
    },
    onError: () => toast.error('Erro ao salvar publicação'),
  });

  const deletePub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_publications' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Publicação removida'); refetchPubs(); },
  });

  // ROI data
  const roiData = useMemo(() => campaigns.map((c: any) => ({
    name: c.name?.substring(0, 20) || 'Sem nome',
    investimento: c.investment || 0,
    receita: c.revenue || 0,
    roi: c.investment > 0 ? (((c.revenue || 0) - c.investment) / c.investment * 100).toFixed(1) : 0,
  })), [campaigns]);

  const platformDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    campaigns.forEach((c: any) => { map[c.platform || 'outros'] = (map[c.platform || 'outros'] || 0) + (c.investment || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  // Funnel data
  const funnelData = useMemo(() => {
    return dealStages.map((stage: any) => ({
      name: stage.name,
      count: deals.filter((d: any) => d.stage_id === stage.id).length,
    }));
  }, [dealStages, deals]);

  const totalInvestment = campaigns.reduce((s: number, c: any) => s + (c.investment || 0), 0);
  const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
  const overallROI = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment * 100).toFixed(1) : '0';

  // Meta Ads config
  const [metaConfigOpen, setMetaConfigOpen] = useState(false);
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaAccountName, setMetaAccountName] = useState('');

  const { data: metaConfig, refetch: refetchMetaConfig } = useQuery({
    queryKey: ['meta-ads-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('meta_ads_config' as any)
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      return data as any;
    },
  });

  const saveMetaConfig = useMutation({
    mutationFn: async () => {
      if (!metaToken || !metaAccountId) throw new Error('Preencha todos os campos');
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('meta_ads_config' as any).upsert({
        user_id: userId,
        access_token: metaToken,
        ad_account_id: metaAccountId,
        account_name: metaAccountName || 'Conta Meta',
        is_active: true,
      }, { onConflict: 'user_id,ad_account_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Credenciais Meta Ads salvas!');
      setMetaConfigOpen(false);
      refetchMetaConfig();
      queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['meta-ads-insights'] });
      queryClient.invalidateQueries({ queryKey: ['meta-ads-daily'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);

  const getPubsForDay = (day: Date) => publications.filter((p: any) => isSameDay(new Date(p.scheduled_date), day));

  const platformBadgeColor = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'bg-blue-500/20 text-blue-400';
      case 'instagram': return 'bg-pink-500/20 text-pink-400';
      case 'linkedin': return 'bg-sky-500/20 text-sky-400';
      case 'google': return 'bg-yellow-500/20 text-yellow-400';
      case 'tiktok': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Rascunho</Badge>;
      case 'scheduled': return <Badge className="bg-blue-500/20 text-blue-600 border-0">Agendada</Badge>;
      case 'published': return <Badge className="bg-green-500/20 text-green-600 border-0">Publicada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{getGreeting()}, {firstName} 👋</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              Marketing Hub — Gerencie campanhas, anúncios e conteúdo
              <TutorialOverlay pageKey="marketing" pageName={tutorialsByPage.marketing.pageName} steps={tutorialsByPage.marketing.steps} />
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={periodDays} onValueChange={setPeriodDays}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {periodDays === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {customRange.from ? format(customRange.from, 'dd/MM') : '??'} - {customRange.to ? format(customRange.to, 'dd/MM') : '??'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={customRange as any}
                    onSelect={(range: any) => setCustomRange(range || {})}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campanhas">
          <TabsList className="w-full flex flex-wrap h-auto gap-1">
            <TabsTrigger value="campanhas" className="flex-1 min-w-[120px]"><Megaphone className="h-4 w-4 mr-1" />Campanhas</TabsTrigger>
            <TabsTrigger value="meta-ads" className="flex-1 min-w-[120px]"><Facebook className="h-4 w-4 mr-1" />Meta Ads</TabsTrigger>
            <TabsTrigger value="calendario" className="flex-1 min-w-[120px]"><CalendarIcon className="h-4 w-4 mr-1" />Calendário</TabsTrigger>
            <TabsTrigger value="roi" className="flex-1 min-w-[120px]"><BarChart3 className="h-4 w-4 mr-1" />Relatórios ROI</TabsTrigger>
            <TabsTrigger value="funil" className="flex-1 min-w-[120px]"><Filter className="h-4 w-4 mr-1" />Funil</TabsTrigger>
          </TabsList>

          {/* Tab 1: Campanhas - uses Meta Ads data */}
          <TabsContent value="campanhas">
            <MetaAdsTab metaConfig={metaConfig} dateRange={dateRange} onOpenConfig={() => setMetaConfigOpen(true)} />
          </TabsContent>

          {/* Tab 2: Meta Ads - full manager */}
          <TabsContent value="meta-ads">
            <MetaAdsTab metaConfig={metaConfig} dateRange={dateRange} onOpenConfig={() => setMetaConfigOpen(true)} />
          </TabsContent>

          {/* Tab 3: Calendário */}
          <TabsContent value="calendario">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>←</Button>
                <h3 className="text-lg font-semibold capitalize">{format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}</h3>
                <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>→</Button>
              </div>
              <Button onClick={() => { setEditingPub(null); setPubDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Publicação
              </Button>
            </div>
            <Card>
              <CardContent className="p-2">
                <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <div key={d} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-card p-2 min-h-[80px]" />
                  ))}
                  {calendarDays.map((day) => {
                    const dayPubs = getPubsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn("bg-card p-1.5 min-h-[80px] cursor-pointer hover:bg-accent/30 transition-colors", isToday && "ring-2 ring-primary ring-inset")}
                        onClick={() => { setEditingPub({ scheduled_date: day.toISOString(), platform: 'instagram', status: 'draft' }); setPubDialogOpen(true); }}
                      >
                        <span className={cn("text-xs font-medium", isToday ? 'text-primary' : 'text-muted-foreground')}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-0.5">
                          {dayPubs.slice(0, 3).map((p: any) => (
                            <div
                              key={p.id}
                              className={cn("text-[10px] px-1 py-0.5 rounded truncate", platformBadgeColor(p.platform))}
                              onClick={(e) => { e.stopPropagation(); setEditingPub(p); setPubDialogOpen(true); }}
                              title={p.title}
                            >
                              {p.title}
                            </div>
                          ))}
                          {dayPubs.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayPubs.length - 3}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Relatórios ROI */}
          <TabsContent value="roi">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">ROI por Campanha</CardTitle></CardHeader>
                <CardContent>
                  {roiData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Sem dados de campanhas</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={roiData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Bar dataKey="investimento" name="Investimento" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Evolução Temporal</CardTitle></CardHeader>
                <CardContent>
                  {roiData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={roiData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Line type="monotone" dataKey="investimento" name="Investimento" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
                        <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Distribuição por Plataforma</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                  {platformDistribution.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={platformDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {platformDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Legend />
                        <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 5: Funil */}
          <TabsContent value="funil">
            <Card>
              <CardHeader>
                <CardTitle>Funil de Vendas</CardTitle>
                <CardDescription>Visualização do funil baseada nos estágios do CRM</CardDescription>
              </CardHeader>
              <CardContent>
                {funnelData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Configure os estágios no CRM para visualizar o funil</p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Bar dataKey="count" name="Deals" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Publication Dialog */}
        <Dialog open={pubDialogOpen} onOpenChange={(o) => { if (!o) { setEditingPub(null); } setPubDialogOpen(o); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingPub?.id ? 'Editar Publicação' : 'Nova Publicação'}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              savePub.mutate({
                id: editingPub?.id,
                title: fd.get('title') as string,
                description: fd.get('description') as string,
                platform: fd.get('platform') as string,
                scheduled_date: fd.get('scheduled_date') as string,
                status: fd.get('status') as string,
              });
            }} className="space-y-4">
              <div><Label>Título</Label><Input name="title" defaultValue={editingPub?.title || ''} required /></div>
              <div><Label>Descrição</Label><Textarea name="description" defaultValue={editingPub?.description || ''} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plataforma</Label>
                  <select name="platform" defaultValue={editingPub?.platform || 'instagram'} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select name="status" defaultValue={editingPub?.status || 'draft'} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Agendada</option>
                    <option value="published">Publicada</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Data/Hora</Label>
                <Input type="datetime-local" name="scheduled_date" defaultValue={editingPub?.scheduled_date ? format(new Date(editingPub.scheduled_date), "yyyy-MM-dd'T'HH:mm") : ''} required />
              </div>
              <DialogFooter className="gap-2">
                {editingPub?.id && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => { deletePub.mutate(editingPub.id); setPubDialogOpen(false); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                )}
                <Button type="submit" disabled={savePub.isPending}>{savePub.isPending ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Meta Ads Config Dialog */}
        <Dialog open={metaConfigOpen} onOpenChange={setMetaConfigOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Configurar Meta Ads</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da conta (opcional)</Label>
                <Input value={metaAccountName} onChange={e => setMetaAccountName(e.target.value)} placeholder="Ex: EggNunes Principal" />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input type="password" value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="Cole seu token aqui" required />
                <p className="text-xs text-muted-foreground mt-1">Gere em developers.facebook.com → Tools → Graph API Explorer</p>
              </div>
              <div>
                <Label>Ad Account ID</Label>
                <Input value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} placeholder="Ex: act_123456789 ou 123456789" required />
                <p className="text-xs text-muted-foreground mt-1">Encontre em Business Settings → Ad Accounts</p>
              </div>
              <DialogFooter>
                <Button onClick={() => saveMetaConfig.mutate()} disabled={saveMetaConfig.isPending}>
                  {saveMetaConfig.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
