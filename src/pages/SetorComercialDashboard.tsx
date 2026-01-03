import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Users, 
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  Scale,
  FileSignature,
  ArrowRight,
  UserPlus,
  Target,
  RefreshCw
} from "lucide-react";
import { format, subDays, parse, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: number;
  timestamp: string;
  nomeCompleto: string;
  cpf: string;
}

interface LeadStats {
  total: number;
  last7Days: number;
  last30Days: number;
  today: number;
}

interface CRMStats {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  activeDeals: number;
  totalValue: number;
  wonValue: number;
  dealsLast30Days: number;
  leadsLast30Days: number;
  leadsLast7Days: number;
  oldestDealDate: string | null;
  oldestLeadDate: string | null;
}

const SetorComercialDashboard = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permissionsLoading } = useAdminPermissions();
  const { isAdmin, profile } = useUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leadStats, setLeadStats] = useState<LeadStats>({ total: 0, last7Days: 0, last30Days: 0, today: 0 });
  const [crmStats, setCrmStats] = useState<CRMStats>({
    totalDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    activeDeals: 0,
    totalValue: 0,
    wonValue: 0,
    dealsLast30Days: 0,
    leadsLast30Days: 0,
    leadsLast7Days: 0,
    oldestDealDate: null,
    oldestLeadDate: null
  });
  const [capturedLeadsCount, setCapturedLeadsCount] = useState(0);
  const [dealsCount, setDealsCount] = useState(0);
  const [contactsCount, setContactsCount] = useState(0);

  const parseTimestamp = (timestamp: string): Date | null => {
    if (!timestamp) return null;
    try {
      const parsed = parse(timestamp, 'dd/MM/yyyy HH:mm:ss', new Date());
      if (!isNaN(parsed.getTime())) return parsed;
      
      const parsedDate = parse(timestamp, 'dd/MM/yyyy', new Date());
      if (!isNaN(parsedDate.getTime())) return parsedDate;
      
      return null;
    } catch {
      return null;
    }
  };

  const fetchClients = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      
      const { data, error } = await supabase.functions.invoke('google-sheets-integration');
      
      if (error) throw error;
      
      if (data.clients) {
        setClients(data.clients);
        
        // Calculate stats
        const today = startOfDay(new Date());
        const sevenDaysAgo = subDays(today, 7);
        const thirtyDaysAgo = subDays(today, 30);
        
        let todayCount = 0;
        let last7DaysCount = 0;
        let last30DaysCount = 0;
        
        data.clients.forEach((client: Client) => {
          const clientDate = parseTimestamp(client.timestamp);
          if (clientDate) {
            const clientDay = startOfDay(clientDate);
            if (clientDay.getTime() === today.getTime()) {
              todayCount++;
            }
            if (isAfter(clientDay, sevenDaysAgo) || clientDay.getTime() === sevenDaysAgo.getTime()) {
              last7DaysCount++;
            }
            if (isAfter(clientDay, thirtyDaysAgo) || clientDay.getTime() === thirtyDaysAgo.getTime()) {
              last30DaysCount++;
            }
          }
        });
        
        setLeadStats({
          total: data.clients.length,
          last7Days: last7DaysCount,
          last30Days: last30DaysCount,
          today: todayCount
        });
        
        if (showToast) {
          toast.success("Dados atualizados com sucesso");
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching clients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCRMStats = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Fetch captured leads with date info
      const { data: leadsData, count: leadsCount } = await supabase
        .from('captured_leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: true });
      
      setCapturedLeadsCount(leadsCount || 0);

      // Count leads last 30 days and 7 days
      const leadsLast30Days = leadsData?.filter(l => l.created_at >= thirtyDaysAgo).length || 0;
      const leadsLast7Days = leadsData?.filter(l => l.created_at >= sevenDaysAgo).length || 0;
      const oldestLeadDate = leadsData?.[0]?.created_at || null;

      // Fetch all deals for statistics
      const { data: dealsData } = await supabase
        .from('crm_deals')
        .select('*, crm_deal_stages(is_won, is_lost)')
        .order('created_at', { ascending: true });

      // Fetch contacts count
      const { count: contacts } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true });
      
      setContactsCount(contacts || 0);

      if (dealsData) {
        const totalDeals = dealsData.length;
        const wonDeals = dealsData.filter(d => d.won === true || d.crm_deal_stages?.is_won).length;
        const lostDeals = dealsData.filter(d => d.won === false || d.crm_deal_stages?.is_lost).length;
        const activeDeals = totalDeals - wonDeals - lostDeals;
        const totalValue = dealsData.reduce((sum, d) => sum + (d.value || 0), 0);
        const wonValue = dealsData.filter(d => d.won === true || d.crm_deal_stages?.is_won).reduce((sum, d) => sum + (d.value || 0), 0);
        const dealsLast30Days = dealsData.filter(d => d.created_at >= thirtyDaysAgo).length;
        const oldestDealDate = dealsData[0]?.created_at || null;

        setCrmStats({
          totalDeals,
          wonDeals,
          lostDeals,
          activeDeals,
          totalValue,
          wonValue,
          dealsLast30Days,
          leadsLast30Days,
          leadsLast7Days,
          oldestDealDate,
          oldestLeadDate
        });
        setDealsCount(totalDeals);
      }
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPeriodLabel = (date: string | null) => {
    if (!date) return "todo período";
    try {
      return `desde ${format(new Date(date), "MMM/yyyy", { locale: ptBR })}`;
    } catch {
      return "todo período";
    }
  };

  useEffect(() => {
    fetchClients();
    fetchCRMStats();
  }, []);

  // Get most recent clients
  const recentClients = [...clients].reverse().slice(0, 5);

  if (permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const canAccess = hasPermission('advbox', 'view');

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Scale className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta seção.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Setor Comercial</h1>
            <p className="text-muted-foreground">
              Visão geral do setor comercial, leads e oportunidades
            </p>
          </div>
          <Button 
            onClick={() => fetchClients(true)} 
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Main Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Formulários</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{leadStats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    clientes preencheram o formulário
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Formulários (7 dias)</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{leadStats.last7Days}</div>
                  <p className="text-xs text-muted-foreground">
                    novos nos últimos 7 dias
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Capturados</CardTitle>
              <UserPlus className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{capturedLeadsCount}</div>
              <p className="text-xs text-muted-foreground">
                {formatPeriodLabel(crmStats.oldestLeadDate)} • via landing pages
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negócios no CRM</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dealsCount}</div>
              <p className="text-xs text-muted-foreground">
                {formatPeriodLabel(crmStats.oldestDealDate)} • total acumulado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CRM Performance Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negócios Ganhos</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{crmStats.wonDeals}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(crmStats.wonValue)} em valor
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negócios Ativos</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{crmStats.activeDeals}</div>
              <p className="text-xs text-muted-foreground">
                em andamento no funil
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Pipeline</CardTitle>
              <Scale className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(crmStats.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                soma de todos os negócios
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos (30 dias)</CardTitle>
              <UserPlus className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{crmStats.dealsLast30Days}</div>
              <p className="text-xs text-muted-foreground">
                negócios criados no mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/setor-comercial/contratos')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileSignature className="h-5 w-5 text-primary" />
                Contratos e Documentos
              </CardTitle>
              <CardDescription>
                Gerar contratos, procurações e declarações
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {leadStats.total} clientes disponíveis
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/crm')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                CRM
              </CardTitle>
              <CardDescription>
                Gerenciar contatos e oportunidades
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {contactsCount} contatos • {dealsCount} negócios
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          {(isAdmin || profile?.position === 'socio') && (
            <Card 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate('/lead-tracking')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Tracking de Leads
                </CardTitle>
                <CardDescription>
                  Acompanhar origem e conversão de leads
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {capturedLeadsCount} leads capturados
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Últimos Formulários Preenchidos</CardTitle>
              <CardDescription>
                Clientes mais recentes que preencheram o formulário
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/setor-comercial/contratos')}
            >
              Ver todos
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : recentClients.length > 0 ? (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div 
                    key={client.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{client.nomeCompleto}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {client.timestamp}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/setor-comercial/contratos')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Gerar Documento
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leadStats.today}</div>
              <p className="text-xs text-muted-foreground">formulários preenchidos hoje</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leadStats.last7Days}</div>
              <p className="text-xs text-muted-foreground">nos últimos 7 dias</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Este Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leadStats.last30Days}</div>
              <p className="text-xs text-muted-foreground">nos últimos 30 dias</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SetorComercialDashboard;
