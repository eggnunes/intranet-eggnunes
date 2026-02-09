import { Wifi, WifiOff, RefreshCw, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ZapiConnectionBannerProps {
  connected: boolean | null;
  loading: boolean;
  error: string | null;
  settingUpWebhooks: boolean;
  onRefresh: () => void;
  onSetupWebhooks: () => Promise<any>;
}

export function ZapiConnectionBanner({
  connected,
  loading,
  error,
  settingUpWebhooks,
  onRefresh,
  onSetupWebhooks,
}: ZapiConnectionBannerProps) {
  const { toast } = useToast();

  const handleSetupWebhooks = async () => {
    try {
      const result = await onSetupWebhooks();
      toast({
        title: 'Webhooks configurados',
        description: result?.message || 'Webhooks registrados com sucesso.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao configurar webhooks',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  // While checking
  if (loading && connected === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm">
        <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin flex-shrink-0" />
        <span className="text-amber-700 dark:text-amber-300">Verificando conexão com Z-API...</span>
      </div>
    );
  }

  // Connected
  if (connected === true) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-300">Z-API conectada</span>
          {loading && <Loader2 className="h-3 w-3 text-green-600 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-green-700 dark:text-green-300 hover:text-green-800"
            onClick={handleSetupWebhooks}
            disabled={settingUpWebhooks}
          >
            {settingUpWebhooks ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Settings className="h-3 w-3 mr-1" />}
            Configurar Webhooks
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    );
  }

  // Disconnected
  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 font-medium">
            Z-API desconectada — mensagens não serão entregues
          </span>
          {loading && <Loader2 className="h-3 w-3 text-red-600 animate-spin" />}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
        <p>Reconecte o WhatsApp no painel da Z-API e clique em "Configurar Webhooks".</p>
        {error && <p className="text-red-500/70">Detalhes: {error}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
        onClick={handleSetupWebhooks}
        disabled={settingUpWebhooks}
      >
        {settingUpWebhooks ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Settings className="h-3 w-3 mr-1" />}
        Configurar Webhooks
      </Button>
    </div>
  );
}
