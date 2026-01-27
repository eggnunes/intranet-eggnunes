import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database,
  ArrowDownCircle,
  ArrowUpCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails?: string[];
  period: { start: string; end: string };
}

interface SyncHistory {
  id: string;
  created_at: string;
  dados_novos: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    period: { start: string; end: string };
  };
}

export function AdvboxFinancialSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [months, setMonths] = useState('12');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [lastSync, setLastSync] = useState<SyncHistory | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [stats, setStats] = useState<{
    totalLocal: number;
    totalAdvbox: number;
    lastUpdated: string | null;
  }>({ totalLocal: 0, totalAdvbox: 0, lastUpdated: null });

  useEffect(() => {
    fetchStats();
    fetchLastSync();
  }, []);

  const fetchStats = async () => {
    try {
      // Count local advbox-synced lancamentos
      const { count: localCount } = await supabase
        .from('fin_lancamentos')
        .select('*', { count: 'exact', head: true })
        .not('advbox_transaction_id', 'is', null);

      // Get last sync timestamp
      const { data: lastSyncData } = await supabase
        .from('advbox_financial_sync')
        .select('last_updated')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      setStats({
        totalLocal: localCount || 0,
        totalAdvbox: 0,
        lastUpdated: lastSyncData?.last_updated || null,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchLastSync = async () => {
    try {
      const { data } = await supabase
        .from('audit_log')
        .select('id, created_at, dados_novos')
        .eq('acao', 'sync_advbox')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLastSync(data as SyncHistory);
      }
    } catch (error) {
      console.error('Erro ao buscar última sincronização:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setProgress(10);
    setSyncResult(null);

    try {
      setProgress(20);
      toast.info('Iniciando sincronização com ADVBox...');

      const { data, error } = await supabase.functions.invoke('sync-advbox-financial', {
        body: { 
          months: parseInt(months),
          force_update: forceUpdate
        }
      });

      setProgress(90);

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.message || data.error || 'Erro desconhecido');
      }

      setSyncResult(data);
      setProgress(100);

      toast.success(`Sincronização concluída! ${data.created} novos, ${data.updated} atualizados.`);
      
      // Refresh stats
      fetchStats();
      fetchLastSync();

    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sincronização ADVBox
            </CardTitle>
            <CardDescription>
              Importe lançamentos financeiros do ADVBox para o sistema local
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            {stats.totalLocal} lançamentos sincronizados
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              Importados
            </div>
            <div className="text-2xl font-bold mt-1">{stats.totalLocal}</div>
            <div className="text-xs text-muted-foreground">lançamentos do ADVBox</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Última Sincronização
            </div>
            <div className="text-lg font-semibold mt-1">
              {stats.lastUpdated 
                ? format(new Date(stats.lastUpdated), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : 'Nunca'
              }
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Status
            </div>
            <div className="mt-1">
              {syncing ? (
                <Badge variant="secondary" className="animate-pulse">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sincronizando...
                </Badge>
              ) : stats.totalLocal > 0 ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Sincronizado
                </Badge>
              ) : (
                <Badge variant="outline">
                  Aguardando
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Sync Options */}
        <div className="rounded-lg border p-4 space-y-4">
          <h4 className="font-medium">Opções de Sincronização</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={months} onValueChange={setMonths}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último mês</SelectItem>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Último ano</SelectItem>
                  <SelectItem value="24">Últimos 2 anos</SelectItem>
                  <SelectItem value="60">Últimos 5 anos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Switch 
                id="force-update" 
                checked={forceUpdate}
                onCheckedChange={setForceUpdate}
              />
              <Label htmlFor="force-update" className="text-sm">
                Forçar atualização de registros existentes
              </Label>
            </div>
          </div>

          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="w-full"
            size="lg"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Sincronizar Agora
              </>
            )}
          </Button>

          {syncing && progress > 0 && (
            <Progress value={progress} className="h-2" />
          )}
        </div>

        {/* Last Sync Result */}
        {syncResult && (
          <Alert variant={syncResult.errors > 0 ? "destructive" : "default"}>
            {syncResult.errors > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>
              Sincronização {syncResult.success ? 'concluída' : 'com problemas'}
            </AlertTitle>
            <AlertDescription>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <ArrowDownCircle className="h-4 w-4 text-green-500" />
                  <span><strong>{syncResult.created}</strong> novos</span>
                </div>
                <div className="flex items-center gap-1">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span><strong>{syncResult.updated}</strong> atualizados</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span><strong>{syncResult.skipped}</strong> ignorados</span>
                </div>
                {syncResult.errors > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span><strong>{syncResult.errors}</strong> erros</span>
                  </div>
                )}
              </div>
              {syncResult.errorDetails && syncResult.errorDetails.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <p className="font-medium">Primeiros erros:</p>
                  <ul className="list-disc list-inside">
                    {syncResult.errorDetails.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Last Sync History */}
        {lastSync && !syncResult && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-medium text-sm mb-2">Última sincronização</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Data: {format(new Date(lastSync.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              {lastSync.dados_novos && (
                <p>
                  Resultado: {lastSync.dados_novos.created} criados, {lastSync.dados_novos.updated} atualizados, {lastSync.dados_novos.skipped} ignorados
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription className="text-sm">
            A sincronização busca todas as transações do ADVBox no período selecionado e as importa para o sistema financeiro local. 
            Transações já importadas são ignoradas (a menos que você force a atualização). 
            Os dados são salvos localmente para carregamento rápido e acesso offline.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
