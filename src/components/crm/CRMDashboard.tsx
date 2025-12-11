import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Users, Target, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CRMContactsList } from './CRMContactsList';
import { CRMDealsKanban } from './CRMDealsKanban';
import { CRMActivities } from './CRMActivities';
import { CRMSettings } from './CRMSettings';

interface CRMStats {
  totalContacts: number;
  totalDeals: number;
  totalValue: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
}

export const CRMDashboard = () => {
  const [stats, setStats] = useState<CRMStats>({
    totalContacts: 0,
    totalDeals: 0,
    totalValue: 0,
    openDeals: 0,
    wonDeals: 0,
    lostDeals: 0
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('crm_settings')
      .select('*')
      .single();
    
    if (data) {
      setSyncEnabled(data.rd_station_sync_enabled);
      setLastSync(data.last_full_sync_at);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch contacts count
      const { count: contactsCount } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true });

      // Fetch deals stats
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('value, won, closed_at');

      const totalDeals = deals?.length || 0;
      const totalValue = deals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0;
      const openDeals = deals?.filter(d => d.closed_at === null).length || 0;
      const wonDeals = deals?.filter(d => d.won === true).length || 0;
      const lostDeals = deals?.filter(d => d.won === false && d.closed_at !== null).length || 0;

      setStats({
        totalContacts: contactsCount || 0,
        totalDeals,
        totalValue,
        openDeals,
        wonDeals,
        lostDeals
      });
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-sync', {
        body: { action: 'full_sync' }
      });

      if (error) throw error;

      toast.success(
        `Sincronização concluída: ${data.pipelines?.pipelines || 0} pipelines, ${data.contacts?.contacts || 0} contatos, ${data.deals?.deals || 0} oportunidades`
      );

      fetchStats();
      fetchSettings();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com status de sincronização */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">CRM</h2>
          <p className="text-muted-foreground">
            Gestão de leads e oportunidades
          </p>
        </div>
        <div className="flex items-center gap-4">
          {syncEnabled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Modo Espelho
              </Badge>
              {lastSync && (
                <span>
                  Última sync: {new Date(lastSync).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          )}
          <Button
            onClick={handleFullSync}
            disabled={syncing}
            variant="outline"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar RD Station
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Contatos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalContacts}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Oportunidades</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalDeals}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Valor Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Em Aberto</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{stats.openDeals}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Ganhas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.wonDeals}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Perdidas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.lostDeals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="kanban">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-6">
          <CRMDealsKanban syncEnabled={syncEnabled} />
        </TabsContent>
        
        <TabsContent value="contacts" className="mt-6">
          <CRMContactsList syncEnabled={syncEnabled} />
        </TabsContent>
        
        <TabsContent value="activities" className="mt-6">
          <CRMActivities syncEnabled={syncEnabled} />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <CRMSettings onSettingsChange={fetchSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
