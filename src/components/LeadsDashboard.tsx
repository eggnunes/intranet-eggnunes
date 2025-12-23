import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Users, TrendingUp, Search, Download, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  rd_station_synced: boolean;
  created_at: string;
  form_id: string | null;
}

interface LeadStats {
  total: number;
  today: number;
  week: number;
  bySource: Record<string, number>;
  byCampaign: Record<string, number>;
  byAdSet: Record<string, number>;
  byAd: Record<string, number>;
}

export function LeadsDashboard() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({ total: 0, today: 0, week: 0, bySource: {}, byCampaign: {}, byAdSet: {}, byAd: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [filterAdSet, setFilterAdSet] = useState('all');
  const [filterAd, setFilterAd] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('30');

  useEffect(() => {
    fetchLeads();
  }, [filterPeriod]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(filterPeriod));
      
      const { data, error } = await supabase
        .from('captured_leads')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeads(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (leadsData: Lead[]) => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const weekStart = subDays(today, 7);

    const bySource: Record<string, number> = {};
    const byCampaign: Record<string, number> = {};
    const byAdSet: Record<string, number> = {};
    const byAd: Record<string, number> = {};

    let todayCount = 0;
    let weekCount = 0;

    leadsData.forEach((lead) => {
      const leadDate = new Date(lead.created_at);

      if (leadDate >= todayStart) todayCount++;
      if (leadDate >= weekStart) weekCount++;

      const source = lead.utm_source || 'Direto';
      bySource[source] = (bySource[source] || 0) + 1;

      if (lead.utm_campaign) {
        byCampaign[lead.utm_campaign] = (byCampaign[lead.utm_campaign] || 0) + 1;
      }

      if (lead.utm_content) {
        byAdSet[lead.utm_content] = (byAdSet[lead.utm_content] || 0) + 1;
      }

      if (lead.utm_term) {
        byAd[lead.utm_term] = (byAd[lead.utm_term] || 0) + 1;
      }
    });

    setStats({
      total: leadsData.length,
      today: todayCount,
      week: weekCount,
      bySource,
      byCampaign,
      byAdSet,
      byAd,
    });
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSource = filterSource === 'all' || lead.utm_source === filterSource;
    const matchesCampaign = filterCampaign === 'all' || lead.utm_campaign === filterCampaign;
    const matchesAdSet = filterAdSet === 'all' || lead.utm_content === filterAdSet;
    const matchesAd = filterAd === 'all' || lead.utm_term === filterAd;

    return matchesSearch && matchesSource && matchesCampaign && matchesAdSet && matchesAd;
  });

  const uniqueSources = [...new Set(leads.map((l) => l.utm_source).filter(Boolean))];
  const uniqueCampaigns = [...new Set(leads.map((l) => l.utm_campaign).filter(Boolean))];
  const uniqueAdSets = [...new Set(leads.map((l) => l.utm_content).filter(Boolean))];
  const uniqueAds = [...new Set(leads.map((l) => l.utm_term).filter(Boolean))];

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Origem', 'Mídia', 'Campanha', 'Conteúdo', 'Termo', 'Landing Page', 'RD Station', 'Data'];
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.email || '',
      lead.phone,
      lead.utm_source || '',
      lead.utm_medium || '',
      lead.utm_campaign || '',
      lead.utm_content || '',
      lead.utm_term || '',
      lead.landing_page || '',
      lead.rd_station_synced ? 'Sim' : 'Não',
      format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!' });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Últimos {filterPeriod} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Leads capturados hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.week}</div>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Origem</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} leads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Origin Report */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Source */}
        {Object.keys(stats.bySource).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Por Origem (Source)
              </CardTitle>
              <CardDescription>De onde os leads vieram</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-sm">{source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs min-w-[40px] justify-center">
                          {count}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Campaign */}
        {Object.keys(stats.byCampaign).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Por Campanha
              </CardTitle>
              <CardDescription>Campanhas de marketing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byCampaign)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([campaign, count]) => (
                    <div key={campaign} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[180px]" title={campaign}>{campaign}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs min-w-[40px] justify-center">
                          {count}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Ad Set */}
        {Object.keys(stats.byAdSet).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Por Conjunto de Anúncios
              </CardTitle>
              <CardDescription>Segmentação de público</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byAdSet)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([adSet, count]) => (
                    <div key={adSet} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[180px]" title={adSet}>{adSet}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs min-w-[40px] justify-center">
                          {count}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Ad */}
        {Object.keys(stats.byAd).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Por Anúncio
              </CardTitle>
              <CardDescription>Criativos específicos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byAd)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([ad, count]) => (
                    <div key={ad} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[180px]" title={ad}>{ad}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs min-w-[40px] justify-center">
                          {count}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Leads Capturados</CardTitle>
              <CardDescription>Lista de todos os leads com dados de tracking</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchLeads}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {uniqueSources.map((source) => (
                  <SelectItem key={source} value={source!}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCampaign} onValueChange={setFilterCampaign}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas campanhas</SelectItem>
                {uniqueCampaigns.map((campaign) => (
                  <SelectItem key={campaign} value={campaign!}>
                    {campaign}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAdSet} onValueChange={setFilterAdSet}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Conj. Anúncios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos conjuntos</SelectItem>
                {uniqueAdSets.map((adSet) => (
                  <SelectItem key={adSet} value={adSet!}>
                    {adSet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAd} onValueChange={setFilterAd}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Anúncio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos anúncios</SelectItem>
                {uniqueAds.map((ad) => (
                  <SelectItem key={ad} value={ad!}>
                    {ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filteredLeads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum lead encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Conj. Anúncios</TableHead>
                    <TableHead>Anúncio</TableHead>
                    <TableHead>RD Station</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{lead.phone}</div>
                          {lead.email && (
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {lead.utm_source && (
                            <Badge variant="secondary" className="text-xs">
                              {lead.utm_source}
                            </Badge>
                          )}
                          {lead.utm_medium && (
                            <Badge variant="outline" className="text-xs">
                              {lead.utm_medium}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.utm_campaign ? (
                          <span className="text-sm">{lead.utm_campaign}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.utm_content ? (
                          <span className="text-sm">{lead.utm_content}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.utm_term ? (
                          <span className="text-sm">{lead.utm_term}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.rd_station_synced ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), 'HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
