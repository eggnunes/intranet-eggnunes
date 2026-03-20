import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Users, TrendingUp, Search, Download, RefreshCw, CheckCircle, XCircle, ExternalLink, Globe, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Ícones SVG para plataformas que o Lucide não tem
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface SourceConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
}

function getSourceConfig(source: string): SourceConfig {
  switch (source.toLowerCase()) {
    case 'facebook':
    case 'fb':
      return { icon: <FacebookIcon className="h-3.5 w-3.5" />, color: 'text-white', bgColor: 'bg-[#1877F2]', label: 'Facebook' };
    case 'instagram':
    case 'ig':
      return { icon: <InstagramIcon className="h-3.5 w-3.5" />, color: 'text-white', bgColor: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', label: 'Instagram' };
    case 'google':
      return { icon: <GoogleIcon className="h-3.5 w-3.5" />, color: 'text-foreground', bgColor: 'bg-muted', label: 'Google' };
    case 'organic':
    case 'organico':
    case 'direto':
      return { icon: <Link className="h-3.5 w-3.5" />, color: 'text-muted-foreground', bgColor: 'bg-muted', label: source };
    default:
      return { icon: <Globe className="h-3.5 w-3.5" />, color: 'text-muted-foreground', bgColor: 'bg-muted', label: source };
  }
}

function SourceBadge({ source }: { source: string }) {
  const config = getSourceConfig(source);
  return (
    <Badge className={`${config.bgColor} ${config.color} text-xs gap-1 border-0`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

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
                      <SourceBadge source={source} />
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
                            <SourceBadge source={lead.utm_source} />
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
