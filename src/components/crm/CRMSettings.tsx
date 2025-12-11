import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, History, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

interface SyncLog {
  id: string;
  sync_type: string;
  entity_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface CRMSettingsProps {
  onSettingsChange: () => void;
}

export const CRMSettings = ({ onSettingsChange }: CRMSettingsProps) => {
  const { profile } = useUserRole();
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const isSocio = profile?.position === 'socio' || profile?.email === 'rafael@eggnunes.com.br';

  useEffect(() => {
    fetchSettings();
    fetchSyncLogs();
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
    setLoading(false);
  };

  const fetchSyncLogs = async () => {
    const { data } = await supabase
      .from('crm_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    setSyncLogs(data || []);
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!isSocio) {
      toast.error('Apenas sócios podem alterar esta configuração');
      return;
    }

    const { error } = await supabase
      .from('crm_settings')
      .update({ rd_station_sync_enabled: enabled })
      .eq('id', (await supabase.from('crm_settings').select('id').single()).data?.id);

    if (error) {
      toast.error('Erro ao atualizar configuração');
      return;
    }

    setSyncEnabled(enabled);
    onSettingsChange();
    toast.success(enabled 
      ? 'Sync bidirecional ativado - alterações sincronizam com RD Station'
      : 'Modo independente ativado - CRM opera somente local'
    );
  };

  const getSyncTypeName = (type: string) => {
    const types: Record<string, string> = {
      full: 'Sincronização Completa',
      manual: 'Manual',
      webhook: 'Webhook',
      bidirectional: 'Bidirecional'
    };
    return types[type] || type;
  };

  const getEntityTypeName = (type: string) => {
    const types: Record<string, string> = {
      pipeline: 'Pipeline',
      contact: 'Contato',
      deal: 'Oportunidade',
      stage: 'Etapa',
      deal_stage: 'Etapa de Oportunidade',
      activity: 'Atividade'
    };
    return types[type] || type;
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
      {/* Sync Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Operação</CardTitle>
          <CardDescription>
            Configure como o CRM interage com o RD Station
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sync-mode" className="text-base">Sincronização com RD Station</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativado, alterações feitas aqui são sincronizadas automaticamente com o RD Station
              </p>
            </div>
            <Switch
              id="sync-mode"
              checked={syncEnabled}
              onCheckedChange={handleToggleSync}
              disabled={!isSocio}
            />
          </div>

          {syncEnabled && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <CheckCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-blue-700">Sync Bidirecional Ativo</p>
                <p className="text-sm text-blue-600">
                  Alterações feitas na intranet são sincronizadas automaticamente com o RD Station.
                  Você pode editar leads e oportunidades aqui - as mudanças aparecem em ambos os sistemas.
                </p>
              </div>
            </div>
          )}

          {!syncEnabled && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-green-700">Modo Independente</p>
                <p className="text-sm text-green-600">
                  O CRM opera de forma independente. Alterações feitas aqui não são sincronizadas com o RD Station.
                </p>
              </div>
            </div>
          )}

          {lastSync && (
            <div className="text-sm text-muted-foreground">
              Última sincronização completa: {new Date(lastSync).toLocaleString('pt-BR')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Sincronização
          </CardTitle>
          <CardDescription>
            Últimas 20 sincronizações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma sincronização realizada ainda
            </p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {getSyncTypeName(log.sync_type)} - {getEntityTypeName(log.entity_type)}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-500">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future: Webhook configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Webhooks</CardTitle>
          <CardDescription>
            Configure webhooks no RD Station para sincronização em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para receber atualizações em tempo real do RD Station, configure os seguintes webhooks:
            </p>
            
            <div className="space-y-2">
              <Label>URL do Webhook (CRM)</Label>
              <code className="block p-3 rounded bg-muted text-sm break-all">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-webhook?secret=SEU_SECRET`}
              </code>
              <p className="text-xs text-muted-foreground">
                Substitua SEU_SECRET pelo valor configurado em RD_STATION_WEBHOOK_SECRET
              </p>
            </div>

            <div className="text-sm">
              <p className="font-medium mb-2">Eventos recomendados:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Contato criado/atualizado</li>
                <li>Oportunidade criada/atualizada</li>
                <li>Oportunidade movida de etapa</li>
                <li>Oportunidade ganha/perdida</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
