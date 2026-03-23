import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Loader2, Pause, Play, Eye, MousePointerClick, DollarSign, Users, TrendingUp, ArrowUpDown
} from 'lucide-react';

const PIE_COLORS = ['hsl(215, 80%, 55%)', 'hsl(340, 75%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(45, 90%, 50%)', 'hsl(280, 60%, 55%)', 'hsl(20, 80%, 55%)', 'hsl(190, 70%, 45%)'];

interface AdPerformanceReportProps {
  dateRange: { from: Date; to: Date };
}

type SortField = 'ad_name' | 'impressions' | 'clicks' | 'spend' | 'leads' | 'cpl';
type SortDir = 'asc' | 'desc';

export default function AdPerformanceReport({ dateRange }: AdPerformanceReportProps) {
  const queryClient = useQueryClient();
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [adsetFilter, setAdsetFilter] = useState('all');
  const [leadFilter, setLeadFilter] = useState<'all' | 'with' | 'without'>('all');
  const [sortField, setSortField] = useState<SortField>('leads');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const dateFrom = format(dateRange.from, 'yyyy-MM-dd');
  const dateTo = format(dateRange.to, 'yyyy-MM-dd');

  // Fetch ad-level insights from Meta
  const { data: adInsights = [], isLoading: loadingInsights } = useQuery({
    queryKey: ['ad-insights', dateFrom, dateTo],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return [];
      const resp = await supabase.functions.invoke('meta-ads', {
        body: { action: 'ad_insights', date_from: dateFrom, date_to: dateTo },
      });
      if (resp.error) { toast.error('Erro ao buscar anúncios'); return []; }
      return resp.data?.ad_insights || [];
    },
  });

  // Fetch leads from captured_leads
  const { data: metaLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['ad-leads-meta', dateFrom, dateTo],
    queryFn: async () => {
      const resp = await supabase.functions.invoke('meta-ads', {
        body: { action: 'leads_meta', date_from: dateFrom, date_to: dateTo },
      });
      return resp.data?.leads || [];
    },
  });

  // Update ad status mutation
  const updateAdStatus = useMutation({
    mutationFn: async ({ ad_id, new_status }: { ad_id: string; new_status: string }) => {
      const resp = await supabase.functions.invoke('meta-ads', {
        body: { action: 'update_ad_status', ad_id, new_status },
      });
      if (resp.error || resp.data?.error) throw new Error(resp.data?.error || 'Erro');
    },
    onSuccess: () => {
      toast.success('Status do anúncio atualizado!');
      queryClient.invalidateQueries({ queryKey: ['ad-insights'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });

  // Build lead count map by utm_term (ad name)
  const leadsByAdName = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lead of metaLeads) {
      const term = (lead.utm_term || '').trim();
      if (term) {
        map[term] = (map[term] || 0) + 1;
      }
    }
    return map;
  }, [metaLeads]);

  // Merge insights with lead counts
  const mergedData = useMemo(() => {
    return adInsights.map((ad: any) => {
      const adName = ad.ad_name || '';
      const leads = leadsByAdName[adName] || 0;
      const spend = parseFloat(ad.spend || '0');
      return {
        ad_id: ad.ad_id,
        ad_name: adName,
        ad_status: ad.ad_status || 'UNKNOWN',
        adset_name: ad.adset_name || '',
        adset_id: ad.adset_id || '',
        campaign_name: ad.campaign_name || '',
        campaign_id: ad.campaign_id || '',
        impressions: parseInt(ad.impressions || '0'),
        clicks: parseInt(ad.clicks || '0'),
        ctr: parseFloat(ad.ctr || '0'),
        cpc: parseFloat(ad.cpc || '0'),
        spend,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
      };
    });
  }, [adInsights, leadsByAdName]);

  // Extract unique campaigns and adsets
  const campaigns = useMemo(() => {
    const set = new Set(mergedData.map((d: any) => d.campaign_name));
    return Array.from(set).sort();
  }, [mergedData]);

  const adsets = useMemo(() => {
    let filtered = mergedData;
    if (campaignFilter !== 'all') filtered = filtered.filter((d: any) => d.campaign_name === campaignFilter);
    const set = new Set(filtered.map((d: any) => d.adset_name));
    return Array.from(set).sort();
  }, [mergedData, campaignFilter]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let data = mergedData;
    if (campaignFilter !== 'all') data = data.filter((d: any) => d.campaign_name === campaignFilter);
    if (adsetFilter !== 'all') data = data.filter((d: any) => d.adset_name === adsetFilter);
    if (leadFilter === 'with') data = data.filter((d: any) => d.leads > 0);
    if (leadFilter === 'without') data = data.filter((d: any) => d.leads === 0);

    data.sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return data;
  }, [mergedData, campaignFilter, adsetFilter, leadFilter, sortField, sortDir]);

  // Summary cards
  const summary = useMemo(() => {
    const activeAds = mergedData.filter((d: any) => d.ad_status === 'ACTIVE').length;
    const adsWithLeads = mergedData.filter((d: any) => d.leads > 0).length;
    const adsWithoutLeads = mergedData.filter((d: any) => d.leads === 0).length;
    const totalSpend = mergedData.reduce((s: number, d: any) => s + d.spend, 0);
    const totalLeads = mergedData.reduce((s: number, d: any) => s + d.leads, 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    return { activeAds, adsWithLeads, adsWithoutLeads, avgCPL, totalLeads, totalSpend };
  }, [mergedData]);

  // Charts data
  const topAdsChart = useMemo(() => {
    return [...mergedData]
      .filter((d: any) => d.leads > 0)
      .sort((a: any, b: any) => b.leads - a.leads)
      .slice(0, 10)
      .map((d: any) => ({ name: d.ad_name.substring(0, 30), leads: d.leads, gasto: d.spend }));
  }, [mergedData]);

  const campaignPieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of mergedData) {
      if (d.leads > 0) {
        map[d.campaign_name] = (map[d.campaign_name] || 0) + d.leads;
      }
    }
    return Object.entries(map).map(([name, value]) => ({ name: name.substring(0, 25), value }));
  }, [mergedData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const isLoading = loadingInsights || loadingLeads;

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Badge className="bg-green-500/20 text-green-600 border-0">Ativo</Badge>;
      case 'PAUSED': return <Badge className="bg-yellow-500/20 text-yellow-600 border-0">Pausado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Campanha</label>
              <Select value={campaignFilter} onValueChange={v => { setCampaignFilter(v); setAdsetFilter('all'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Conjunto de Anúncios</label>
              <Select value={adsetFilter} onValueChange={setAdsetFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os conjuntos</SelectItem>
                  {adsets.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">Leads</label>
              <Select value={leadFilter} onValueChange={(v: any) => setLeadFilter(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with">Só com leads</SelectItem>
                  <SelectItem value="without">Só sem leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground self-center">
              Período: {format(dateRange.from, 'dd/MM/yyyy')} a {format(dateRange.to, 'dd/MM/yyyy')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center">
          <Eye className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs text-muted-foreground">Anúncios Ativos</div>
          <div className="text-lg font-bold text-foreground">{summary.activeAds}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <Users className="h-4 w-4 mx-auto text-green-500 mb-1" />
          <div className="text-xs text-muted-foreground">Com Leads</div>
          <div className="text-lg font-bold text-green-600">{summary.adsWithLeads}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <Users className="h-4 w-4 mx-auto text-destructive mb-1" />
          <div className="text-xs text-muted-foreground">Sem Leads</div>
          <div className="text-lg font-bold text-destructive">{summary.adsWithoutLeads}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs text-muted-foreground">Total Leads</div>
          <div className="text-lg font-bold text-foreground">{summary.totalLeads}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs text-muted-foreground">Gasto Total</div>
          <div className="text-lg font-bold text-foreground">R$ {fmt(summary.totalSpend)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <div className="text-xs text-muted-foreground">CPL Médio</div>
          <div className="text-lg font-bold text-foreground">R$ {fmt(summary.avgCPL)}</div>
        </CardContent></Card>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando dados...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Charts Row */}
          {(topAdsChart.length > 0 || campaignPieData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {topAdsChart.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Top Anúncios por Leads</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topAdsChart} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: any, name: string) => name === 'gasto' ? `R$ ${parseFloat(v).toFixed(2)}` : v} />
                        <Bar dataKey="leads" fill="hsl(160, 60%, 45%)" name="Leads" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {campaignPieData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Leads por Campanha</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={campaignPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                          {campaignPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Main Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Anúncios ({filteredData.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum anúncio encontrado para o período/filtros selecionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHeader field="ad_name">Anúncio</SortHeader>
                        <TableHead>Conjunto</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Status</TableHead>
                        <SortHeader field="impressions">Impressões</SortHeader>
                        <SortHeader field="clicks">Cliques</SortHeader>
                        <SortHeader field="spend">Gasto</SortHeader>
                        <SortHeader field="leads">Leads</SortHeader>
                        <SortHeader field="cpl">CPL</SortHeader>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((ad: any) => (
                        <TableRow key={ad.ad_id} className={ad.leads === 0 ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium max-w-[200px] truncate" title={ad.ad_name}>
                            {ad.ad_name}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground" title={ad.adset_name}>
                            {ad.adset_name}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground" title={ad.campaign_name}>
                            {ad.campaign_name}
                          </TableCell>
                          <TableCell>{statusBadge(ad.ad_status)}</TableCell>
                          <TableCell>{ad.impressions.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{ad.clicks.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>R$ {fmt(ad.spend)}</TableCell>
                          <TableCell>
                            <span className={ad.leads > 0 ? 'font-bold text-green-600' : 'text-destructive'}>
                              {ad.leads}
                            </span>
                          </TableCell>
                          <TableCell>
                            {ad.leads > 0 ? `R$ ${fmt(ad.cpl)}` : '—'}
                          </TableCell>
                          <TableCell>
                            {ad.ad_status === 'ACTIVE' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={updateAdStatus.isPending}
                                onClick={() => updateAdStatus.mutate({ ad_id: ad.ad_id, new_status: 'PAUSED' })}
                              >
                                <Pause className="h-3 w-3 mr-1" /> Pausar
                              </Button>
                            ) : ad.ad_status === 'PAUSED' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={updateAdStatus.isPending}
                                onClick={() => updateAdStatus.mutate({ ad_id: ad.ad_id, new_status: 'ACTIVE' })}
                              >
                                <Play className="h-3 w-3 mr-1" /> Ativar
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
