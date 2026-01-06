import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Users, 
  FileText, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { AsaasCobrancas } from './AsaasCobrancas';
import { AsaasClientes } from './AsaasClientes';
import { AsaasNovaCobranca } from './AsaasNovaCobranca';

interface Statistics {
  pending: { count: number };
  received: { count: number };
  overdue: { count: number };
}

interface Balance {
  balance: number;
}

export function AsaasDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [activeTab, setActiveTab] = useState('cobrancas');
  const [novaCobrancaOpen, setNovaCobrancaOpen] = useState(false);

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

      if (statsRes.error) throw new Error(statsRes.error.message);
      if (balanceRes.error) throw new Error(balanceRes.error.message);

      setStats(statsRes.data);
      setBalance(balanceRes.data);
    } catch (error: any) {
      console.error('Erro ao carregar dados Asaas:', error);
      toast.error('Erro ao conectar com Asaas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Asaas - Gateway de Pagamentos</h2>
          <p className="text-muted-foreground">Gerencie cobranças, boletos e pagamentos parcelados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setNovaCobrancaOpen(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Nova Cobrança
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : formatCurrency(balance?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Disponível para saque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {loading ? '...' : stats?.pending.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : stats?.received.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '...' : stats?.overdue.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Em atraso</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cobrancas">
            <FileText className="h-4 w-4 mr-2" />
            Cobranças
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="h-4 w-4 mr-2" />
            Clientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cobrancas" className="mt-4">
          <AsaasCobrancas onNovaCobranca={() => setNovaCobrancaOpen(true)} />
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <AsaasClientes />
        </TabsContent>
      </Tabs>

      {/* Dialog Nova Cobrança */}
      <AsaasNovaCobranca 
        open={novaCobrancaOpen} 
        onOpenChange={setNovaCobrancaOpen}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
