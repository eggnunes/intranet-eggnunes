import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, RefreshCw, Plus, DollarSign, FileText, ArrowRightLeft, Key, Wallet, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AsaasDashboard, AsaasNovaCobranca } from '@/components/financeiro/asaas';
import { AsaasInvoices } from '@/components/asaas/AsaasInvoices';
import { AsaasTransfers } from '@/components/asaas/AsaasTransfers';
import { AsaasApiKeyAlerts } from '@/components/asaas/AsaasApiKeyAlerts';

interface Statistics {
  pendingCount: number;
  receivedCount: number;
  overdueCount: number;
}

interface Balance {
  balance: number;
}

export default function Asaas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);

  useEffect(() => {
    fetchData();
    fetchAlertsCount();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, balanceRes] = await Promise.all([
        supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_statistics' }
        }),
        supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_balance' }
        })
      ]);

      if (statsRes.data?.statistics) {
        setStatistics(statsRes.data.statistics);
      }
      if (balanceRes.data?.balance !== undefined) {
        setBalance({ balance: balanceRes.data.balance });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertsCount = async () => {
    const { count } = await supabase
      .from('asaas_api_key_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    
    setAlertsCount(count || 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Asaas</h1>
              <p className="text-sm text-muted-foreground">
                Gestão de cobranças, notas fiscais e transferências
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={() => setShowNovaCobranca(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cobrança
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                  <p className="text-2xl font-bold text-green-600">
                    {balance ? formatCurrency(balance.balance) : 'R$ 0,00'}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {statistics?.pendingCount || 0}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recebidas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {statistics?.receivedCount || 0}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vencidas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {statistics?.overdueCount || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alertas API</p>
                  <p className="text-2xl font-bold text-orange-600">{alertsCount}</p>
                </div>
                <Key className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Cobranças</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Notas Fiscais</span>
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Transferências</span>
            </TabsTrigger>
            <TabsTrigger value="api-alerts" className="flex items-center gap-2 relative">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas API</span>
              {alertsCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 px-1">
                  {alertsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AsaasDashboard />
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <AsaasInvoices />
          </TabsContent>

          <TabsContent value="transfers" className="mt-6">
            <AsaasTransfers />
          </TabsContent>

          <TabsContent value="api-alerts" className="mt-6">
            <AsaasApiKeyAlerts onAlertsRead={fetchAlertsCount} />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Asaas</CardTitle>
                <CardDescription>
                  Gerencie as configurações de integração com o Asaas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  As configurações de webhook e clientes estão disponíveis na aba "Cobranças".
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Nova Cobrança Modal */}
        <AsaasNovaCobranca
          open={showNovaCobranca}
          onOpenChange={setShowNovaCobranca}
          onSuccess={() => {
            fetchData();
            setActiveTab('dashboard');
          }}
        />
      </div>
    </Layout>
  );
}
