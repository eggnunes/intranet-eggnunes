import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, MousePointerClick, Eye, Target,
  Plus, Pencil, Trash2, Copy, Play, Pause, Facebook, ArrowUpDown,
  Brain, Users, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

const ACRONYM_TOOLTIPS: Record<string, string> = {
  'CTR': 'Taxa de Cliques (Click-Through Rate)',
  'CPC': 'Custo por Clique (Cost Per Click)',
  'CPL': 'Custo por Lead (Cost Per Lead)',
  'CPM': 'Custo por Mil Impressões (Cost Per Mille)',
  'ROAS': 'Retorno sobre Investimento em Ads (Return On Ad Spend)',
  'CPA': 'Custo por Aquisição (Cost Per Acquisition)',
  'ROI': 'Retorno sobre Investimento (Return On Investment)',
};

function AcronymTip({ acronym, children }: { acronym: string; children?: React.ReactNode }) {
  const tip = ACRONYM_TOOLTIPS[acronym];
  if (!tip) return <>{children || acronym}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted decoration-muted-foreground/50 cursor-help">
          {children || acronym}
        </span>
      </TooltipTrigger>
      <TooltipContent><p>{tip}</p></TooltipContent>
    </Tooltip>
  );
}

interface MetaAdsTabProps {
  metaConfig: any;
  dateRange: { from: Date; to: Date };
  onOpenConfig: () => void;
}

const OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Reconhecimento' },
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfego' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engajamento' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'Promoção de App' },
  { value: 'OUTCOME_SALES', label: 'Vendas' },
];

function formatBRL(val: number) {
  return 'R$ ' + val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNum(val: number) {
  return val.toLocaleString('pt-BR');
}

export default function MetaAdsTab({ metaConfig, dateRange, onOpenConfig }: MetaAdsTabProps) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<string>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [subTab, setSubTab] = useState('overview');

  const fromDateStr = dateRange.from.toISOString().split('T')[0];
  const toDateStr = dateRange.to.toISOString().split('T')[0];
  const hasConfig = !!metaConfig;

  // Queries
  const { data: metaCampaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['meta-ads-campaigns', metaConfig?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', { body: { action: 'campaigns' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.campaigns || [];
    },
    enabled: hasConfig,
  });

  const { data: metaInsights = [], isLoading: loadingInsights } = useQuery({
    queryKey: ['meta-ads-insights', metaConfig?.id, fromDateStr, toDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { action: 'insights', date_from: fromDateStr, date_to: toDateStr },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.insights || [];
    },
    enabled: hasConfig,
  });

  const { data: dailyInsights = [], isLoading: loadingDaily } = useQuery({
    queryKey: ['meta-ads-daily', metaConfig?.id, fromDateStr, toDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { action: 'daily_insights', date_from: fromDateStr, date_to: toDateStr },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.daily || [];
    },
    enabled: hasConfig,
  });

  const { data: metaLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['meta-ads-leads', fromDateStr, toDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { action: 'leads_meta', date_from: fromDateStr, date_to: toDateStr },
      });
      if (error) throw error;
      return data?.leads || [];
    },
    enabled: hasConfig,
  });

  const { data: aiAnalysis, isLoading: loadingAI, refetch: runAI } = useQuery({
    queryKey: ['meta-ads-ai', metaConfig?.id, fromDateStr, toDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-ads', {
        body: { action: 'ai_analysis', date_from: fromDateStr, date_to: toDateStr },
      });
      if (error) throw error;
      return data;
    },
    enabled: false,
  });

  // Mutations
  const campaignAction = useMutation({
    mutationFn: async (params: { action: string; [key: string]: any }) => {
      const { data, error } = await supabase.functions.invoke('meta-ads', { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-ads-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['meta-ads-insights'] });
    },
  });

  const handlePauseActivate = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await campaignAction.mutateAsync({ action: 'update_campaign_status', campaign_id: id, new_status: newStatus });
      toast.success(newStatus === 'ACTIVE' ? 'Campanha ativada!' : 'Campanha pausada!');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicate = async (id: string, name: string) => {
    try {
      await campaignAction.mutateAsync({ action: 'duplicate_campaign', campaign_id: id, new_name: 'Cópia' });
      toast.success(`Campanha "${name}" duplicada!`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.')) return;
    try {
      await campaignAction.mutateAsync({ action: 'delete_campaign', campaign_id: id });
      toast.success('Campanha excluída!');
    } catch (e: any) { toast.error(e.message); }
  };

  // Aggregated totals
  const metaTotals = useMemo(() => {
    let impressions = 0, clicks = 0, spend = 0, reach = 0, conversions = 0;
    metaInsights.forEach((i: any) => {
      impressions += parseInt(i.impressions || '0');
      clicks += parseInt(i.clicks || '0');
      spend += parseFloat(i.spend || '0');
      reach += parseInt(i.reach || '0');
      (i.actions || []).forEach((a: any) => {
        if (['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'complete_registration'].includes(a.action_type)) {
          conversions += parseInt(a.value || '0');
        }
      });
    });
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpl = conversions > 0 ? spend / conversions : 0;
    return { impressions, clicks, spend, reach, ctr, cpc, conversions, cpl };
  }, [metaInsights]);

  // Merged table rows
  const campaignRows = useMemo(() => {
    const statusMap: Record<string, string> = { ACTIVE: 'Ativa', PAUSED: 'Pausada', DELETED: 'Removida', ARCHIVED: 'Arquivada' };
    const rows = metaCampaigns.map((c: any) => {
      const insight = metaInsights.find((i: any) => i.campaign_id === c.id);
      const impressions = parseInt(insight?.impressions || '0');
      const clicks = parseInt(insight?.clicks || '0');
      const spend = parseFloat(insight?.spend || '0');
      const ctr = parseFloat(insight?.ctr || '0');
      const cpc = parseFloat(insight?.cpc || '0');
      const reach = parseInt(insight?.reach || '0');
      const actions = insight?.actions || [];
      const conversions = actions.filter((a: any) =>
        ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'complete_registration'].includes(a.action_type)
      ).reduce((s: number, a: any) => s + parseInt(a.value || '0'), 0);
      const costPerAction = insight?.cost_per_action_type || [];
      return {
        id: c.id,
        name: c.name,
        rawStatus: c.status,
        status: statusMap[c.status] || c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseInt(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
        impressions, clicks, spend, ctr, cpc, reach, conversions,
        cpl: conversions > 0 ? spend / conversions : 0,
        actions, costPerAction,
        created_time: c.created_time,
        bid_strategy: c.bid_strategy,
      };
    });

    rows.sort((a: any, b: any) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });

    return rows;
  }, [metaCampaigns, metaInsights, sortField, sortDir]);

  // Ranking
  const topCampaigns = useMemo(() => [...campaignRows].sort((a, b) => b.spend - a.spend).slice(0, 5), [campaignRows]);
  const bestCTR = useMemo(() => [...campaignRows].filter(c => c.impressions > 100).sort((a, b) => b.ctr - a.ctr).slice(0, 5), [campaignRows]);
  const worstCPC = useMemo(() => [...campaignRows].filter(c => c.clicks > 0).sort((a, b) => b.cpc - a.cpc).slice(0, 5), [campaignRows]);

  // Chart data
  const chartData = useMemo(() => dailyInsights.map((d: any) => ({
    date: d.date_start?.substring(5) || '',
    impressions: parseInt(d.impressions || '0'),
    clicks: parseInt(d.clicks || '0'),
    spend: parseFloat(d.spend || '0'),
    reach: parseInt(d.reach || '0'),
  })), [dailyInsights]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={cn("h-3 w-3 ml-1 inline", sortField === field && 'text-primary')} />
  );

  const isLoading = loadingCampaigns || loadingInsights;

  if (!hasConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Facebook className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">Conecte sua conta Meta Ads</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Configure seu Access Token e ID da conta de anúncios para visualizar métricas reais.
          </p>
          <Button onClick={onOpenConfig}><Plus className="h-4 w-4 mr-1" /> Configurar Meta Ads</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Conta: <span className="font-medium text-foreground">{metaConfig.account_name || metaConfig.ad_account_id}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onOpenConfig}><Pencil className="h-3 w-3 mr-1" /> Credenciais</Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns" className="flex-1 min-w-[100px]">Campanhas</TabsTrigger>
          <TabsTrigger value="charts" className="flex-1 min-w-[100px]">Gráficos</TabsTrigger>
          <TabsTrigger value="ranking" className="flex-1 min-w-[100px]">Ranking</TabsTrigger>
          <TabsTrigger value="leads" className="flex-1 min-w-[100px]">Leads</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 min-w-[100px]"><Brain className="h-3 w-3 mr-1" />IA</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-4">
            {[
              { label: 'Impressões', value: formatNum(metaTotals.impressions), icon: Eye, color: 'text-blue-500' },
              { label: 'Alcance', value: formatNum(metaTotals.reach), icon: Users, color: 'text-violet-500' },
              { label: 'Cliques', value: formatNum(metaTotals.clicks), icon: MousePointerClick, color: 'text-amber-500' },
              { label: 'CTR', value: metaTotals.ctr.toFixed(2) + '%', icon: TrendingUp, color: 'text-green-500' },
              { label: 'CPC Médio', value: formatBRL(metaTotals.cpc), icon: DollarSign, color: 'text-orange-500' },
              { label: 'Conversões', value: formatNum(metaTotals.conversions), icon: Target, color: 'text-emerald-500' },
              { label: 'Gasto Total', value: formatBRL(metaTotals.spend), icon: DollarSign, color: 'text-destructive' },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="pt-4 pb-3 text-center">
                  <m.icon className={cn("h-4 w-4 mx-auto mb-1", m.color)} />
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold text-foreground">{isLoading ? '...' : m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {metaTotals.conversions > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Custo por Lead (Meta)</p>
                    <p className="text-2xl font-bold text-foreground">{formatBRL(metaTotals.cpl)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Leads capturados (UTM)</p>
                    <p className="text-2xl font-bold text-foreground">{metaLeads.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPL via UTM</p>
                    <p className="text-2xl font-bold text-foreground">
                      {metaLeads.length > 0 ? formatBRL(metaTotals.spend / metaLeads.length) : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CAMPAIGNS TABLE */}
        <TabsContent value="campaigns">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : campaignRows.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma campanha encontrada</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('impressions')}>Impressões<SortIcon field="impressions" /></TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('clicks')}>Cliques<SortIcon field="clicks" /></TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('ctr')}>CTR<SortIcon field="ctr" /></TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('cpc')}>CPC<SortIcon field="cpc" /></TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('conversions')}>Conv.<SortIcon field="conversions" /></TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('spend')}>Gasto<SortIcon field="spend" /></TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignRows.map((row) => (
                      <>
                        <TableRow key={row.id} className="cursor-pointer" onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}>
                          <TableCell>{expandedRow === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={row.name}>{row.name}</TableCell>
                          <TableCell>
                            <Badge variant={row.rawStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                              {row.rawStatus === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 inline-block" />}
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatNum(row.impressions)}</TableCell>
                          <TableCell className="text-right">{formatNum(row.clicks)}</TableCell>
                          <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{formatBRL(row.cpc)}</TableCell>
                          <TableCell className="text-right">{row.conversions > 0 ? formatNum(row.conversions) : '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{formatBRL(row.spend)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title={row.rawStatus === 'ACTIVE' ? 'Pausar' : 'Ativar'}
                                onClick={() => handlePauseActivate(row.id, row.rawStatus)} disabled={campaignAction.isPending}>
                                {row.rawStatus === 'ACTIVE' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar"
                                onClick={() => { setEditingCampaign(row); setEditDialogOpen(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar"
                                onClick={() => handleDuplicate(row.id, row.name)} disabled={campaignAction.isPending}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir"
                                onClick={() => handleDelete(row.id)} disabled={campaignAction.isPending}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRow === row.id && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div><span className="text-muted-foreground">Objetivo:</span> <span className="font-medium">{OBJECTIVES.find(o => o.value === row.objective)?.label || row.objective}</span></div>
                                <div><span className="text-muted-foreground">Orçamento diário:</span> <span className="font-medium">{row.daily_budget ? formatBRL(row.daily_budget) : '—'}</span></div>
                                <div><span className="text-muted-foreground">Orçamento total:</span> <span className="font-medium">{row.lifetime_budget ? formatBRL(row.lifetime_budget) : '—'}</span></div>
                                <div><span className="text-muted-foreground">Alcance:</span> <span className="font-medium">{formatNum(row.reach)}</span></div>
                                <div><span className="text-muted-foreground">CPL:</span> <span className="font-medium">{row.cpl > 0 ? formatBRL(row.cpl) : '—'}</span></div>
                                <div><span className="text-muted-foreground">Estratégia de lance:</span> <span className="font-medium">{row.bid_strategy || '—'}</span></div>
                                <div><span className="text-muted-foreground">Criada em:</span> <span className="font-medium">{row.created_time ? new Date(row.created_time).toLocaleDateString('pt-BR') : '—'}</span></div>
                                {row.actions.length > 0 && (
                                  <div className="col-span-2 md:col-span-4">
                                    <span className="text-muted-foreground">Conversões:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {row.actions.map((a: any, i: number) => (
                                        <Badge key={i} variant="outline" className="text-xs">{a.action_type}: {a.value}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CHARTS */}
        <TabsContent value="charts">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Gastos Diários</CardTitle></CardHeader>
              <CardContent>
                {loadingDaily ? <Skeleton className="h-[250px] w-full" /> : chartData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Area type="monotone" dataKey="spend" name="Gasto (R$)" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Impressões e Cliques</CardTitle></CardHeader>
              <CardContent>
                {loadingDaily ? <Skeleton className="h-[250px] w-full" /> : chartData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(215, 80%, 55%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Performance por Campanha</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={campaignRows.slice(0, 10).map(r => ({ name: r.name.substring(0, 25), spend: r.spend, clicks: r.clicks }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="spend" name="Gasto (R$)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="clicks" name="Cliques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RANKING */}
        <TabsContent value="ranking">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-destructive" /> Maiores Gastos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topCampaigns.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate max-w-[180px]">
                      <Badge variant="outline" className="h-5 w-5 flex items-center justify-center p-0 text-xs">{i + 1}</Badge>
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </span>
                    <span className="font-semibold text-destructive">{formatBRL(c.spend)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Melhor CTR</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {bestCTR.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate max-w-[180px]">
                      <Badge variant="outline" className="h-5 w-5 flex items-center justify-center p-0 text-xs">{i + 1}</Badge>
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </span>
                    <span className="font-semibold text-green-500">{c.ctr.toFixed(2)}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500" /> Maior CPC</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {worstCPC.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate max-w-[180px]">
                      <Badge variant="outline" className="h-5 w-5 flex items-center justify-center p-0 text-xs">{i + 1}</Badge>
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </span>
                    <span className="font-semibold text-amber-500">{formatBRL(c.cpc)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads do Meta Ads ({metaLeads.length})</CardTitle>
              <CardDescription>Leads capturados com UTM de Facebook/Instagram/Meta</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLeads ? <Skeleton className="h-[200px] w-full" /> : metaLeads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum lead via Meta no período</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Campanha (UTM)</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metaLeads.slice(0, 50).map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{lead.utm_campaign || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{lead.utm_source || '—'}</Badge></TableCell>
                        <TableCell>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5" /> Análise por IA</CardTitle>
              <CardDescription>Análise automática das campanhas com cruzamento de dados de leads</CardDescription>
            </CardHeader>
            <CardContent>
              {!aiAnalysis && !loadingAI ? (
                <div className="text-center py-8 space-y-4">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Clique abaixo para gerar uma análise inteligente das suas campanhas</p>
                  <Button onClick={() => runAI()}><Brain className="h-4 w-4 mr-1" /> Gerar Análise</Button>
                </div>
              ) : loadingAI ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analisando campanhas e leads...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 text-sm">
                    <Badge variant="outline">{aiAnalysis.campaigns_count} campanhas</Badge>
                    <Badge variant="outline">{aiAnalysis.leads_count} leads Meta</Badge>
                    <Badge variant="outline">Gasto: {formatBRL(aiAnalysis.total_spend || 0)}</Badge>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{aiAnalysis.analysis}</ReactMarkdown>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => runAI()}>
                    <Brain className="h-3 w-3 mr-1" /> Regenerar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE CAMPAIGN DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha Meta Ads</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await campaignAction.mutateAsync({
                action: 'create_campaign',
                name: fd.get('name') as string,
                objective: fd.get('objective') as string,
                status: fd.get('status') as string,
                daily_budget: fd.get('daily_budget') ? parseInt(fd.get('daily_budget') as string) * 100 : undefined,
              });
              toast.success('Campanha criada!');
              setCreateDialogOpen(false);
            } catch (err: any) { toast.error(err.message); }
          }} className="space-y-4">
            <div><Label>Nome</Label><Input name="name" required /></div>
            <div>
              <Label>Objetivo</Label>
              <select name="objective" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" required>
                {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Orçamento diário (R$)</Label>
                <Input name="daily_budget" type="number" step="1" min="1" placeholder="Ex: 50" />
              </div>
              <div>
                <Label>Status inicial</Label>
                <select name="status" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="PAUSED">Pausada</option>
                  <option value="ACTIVE">Ativa</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={campaignAction.isPending}>
                {campaignAction.isPending ? 'Criando...' : 'Criar Campanha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT CAMPAIGN DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Campanha</DialogTitle></DialogHeader>
          {editingCampaign && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await campaignAction.mutateAsync({
                  action: 'update_campaign',
                  campaign_id: editingCampaign.id,
                  name: fd.get('name') as string,
                  daily_budget: fd.get('daily_budget') ? parseInt(fd.get('daily_budget') as string) * 100 : undefined,
                  status: fd.get('status') as string,
                });
                toast.success('Campanha atualizada!');
                setEditDialogOpen(false);
              } catch (err: any) { toast.error(err.message); }
            }} className="space-y-4">
              <div><Label>Nome</Label><Input name="name" defaultValue={editingCampaign.name} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Orçamento diário (R$)</Label>
                  <Input name="daily_budget" type="number" step="1" min="1" defaultValue={editingCampaign.daily_budget || ''} />
                </div>
                <div>
                  <Label>Status</Label>
                  <select name="status" defaultValue={editingCampaign.rawStatus} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="ACTIVE">Ativa</option>
                    <option value="PAUSED">Pausada</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={campaignAction.isPending}>
                  {campaignAction.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
