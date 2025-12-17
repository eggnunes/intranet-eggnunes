import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Cloud,
  Database,
  MessageSquare,
  Brain,
  FileSpreadsheet,
  Users,
  Megaphone,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  secretKeys: string[];
  category: 'crm' | 'communication' | 'ai' | 'productivity' | 'legal';
  testEndpoint?: string;
  isActive: boolean;
  lastTested?: Date;
  testStatus?: 'success' | 'error' | 'testing';
}

const INTEGRATIONS_CONFIG: Omit<Integration, 'isActive' | 'lastTested' | 'testStatus'>[] = [
  {
    id: 'advbox',
    name: 'Advbox',
    description: 'Sistema de gestão jurídica - processos, tarefas, clientes e financeiro',
    icon: <Database className="h-6 w-6" />,
    secretKeys: ['ADVBOX_API_TOKEN'],
    category: 'legal',
    testEndpoint: 'advbox-integration',
  },
  {
    id: 'rd-station',
    name: 'RD Station',
    description: 'CRM e Marketing - leads, oportunidades e campanhas',
    icon: <Megaphone className="h-6 w-6" />,
    secretKeys: ['RD_STATION_API_TOKEN'],
    category: 'crm',
    testEndpoint: 'rd-station-products',
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Integração com SharePoint/OneDrive - arquivos e documentos',
    icon: <Cloud className="h-6 w-6" />,
    secretKeys: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_TENANT_ID', 'MICROSOFT_CLIENT_SECRET'],
    category: 'productivity',
    testEndpoint: 'microsoft-teams',
  },
  {
    id: 'chatguru',
    name: 'ChatGuru',
    description: 'WhatsApp Business - mensagens automáticas e cobrança',
    icon: <MessageSquare className="h-6 w-6" />,
    secretKeys: ['CHATGURU_API_KEY', 'CHATGURU_ACCOUNT_ID', 'CHATGURU_PHONE_ID'],
    category: 'communication',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5.2 e Whisper - assistente IA e transcrição de voz',
    icon: <Brain className="h-6 w-6" />,
    secretKeys: ['OPENAI_API_KEY'],
    category: 'ai',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Pesquisa com IA - busca e análise de informações',
    icon: <Brain className="h-6 w-6" />,
    secretKeys: ['PERPLEXITY_API_KEY'],
    category: 'ai',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Planilhas - importação de dados para contratos',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    secretKeys: ['GOOGLE_SHEETS_API_KEY'],
    category: 'productivity',
  },
  {
    id: 'manus-ia',
    name: 'Manus IA',
    description: 'Modelo de IA especializado',
    icon: <Brain className="h-6 w-6" />,
    secretKeys: ['MANUS_API_KEY'],
    category: 'ai',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM & Marketing',
  communication: 'Comunicação',
  ai: 'Inteligência Artificial',
  productivity: 'Produtividade',
  legal: 'Gestão Jurídica',
};

const CATEGORY_COLORS: Record<string, string> = {
  crm: 'bg-purple-500/10 text-purple-500',
  communication: 'bg-green-500/10 text-green-500',
  ai: 'bg-blue-500/10 text-blue-500',
  productivity: 'bg-orange-500/10 text-orange-500',
  legal: 'bg-amber-500/10 text-amber-500',
};

export default function Integracoes() {
  const { profile, loading: roleLoading } = useUserRole();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const isSocio = profile?.position === 'socio' || profile?.email === 'rafael@eggnunes.com.br';

  useEffect(() => {
    if (!roleLoading) {
      loadIntegrationStatus();
    }
  }, [roleLoading]);

  const loadIntegrationStatus = async () => {
    setLoading(true);
    try {
      // Fetch integration settings from database
      const { data: settings } = await supabase
        .from('integration_settings' as any)
        .select('*');

      const settingsMap = new Map((settings as any[])?.map((s: any) => [s.integration_id, s]) || []);

      const integrationsWithStatus = INTEGRATIONS_CONFIG.map(config => {
        const setting = settingsMap.get(config.id) as any;
        return {
          ...config,
          isActive: setting?.is_active ?? true, // Default to active
          lastTested: setting?.last_tested_at ? new Date(setting.last_tested_at) : undefined,
          testStatus: setting?.test_status as 'success' | 'error' | undefined,
        };
      });

      setIntegrations(integrationsWithStatus);
    } catch (error) {
      console.error('Error loading integrations:', error);
      // If table doesn't exist, show all as active
      setIntegrations(INTEGRATIONS_CONFIG.map(config => ({
        ...config,
        isActive: true,
      })));
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = async (integrationId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('integration_settings' as any)
        .upsert({
          integration_id: integrationId,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'integration_id',
        });

      if (error) throw error;

      setIntegrations(prev => prev.map(i => 
        i.id === integrationId ? { ...i, isActive } : i
      ));

      toast.success(`Integração ${isActive ? 'ativada' : 'desativada'} com sucesso`);
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Erro ao alterar status da integração');
    }
  };

  const testIntegration = async (integration: Integration) => {
    if (!integration.testEndpoint) {
      toast.info('Esta integração não possui teste automatizado');
      return;
    }

    setTestingId(integration.id);
    
    try {
      let testSuccess = false;
      
      if (integration.id === 'advbox') {
        const { data, error } = await supabase.functions.invoke('advbox-integration', {
          body: { action: 'get-lawsuits', limit: 1 },
        });
        testSuccess = !error && data;
      } else if (integration.id === 'rd-station') {
        const { data, error } = await supabase.functions.invoke('rd-station-products', {
          body: {},
        });
        testSuccess = !error && data;
      } else if (integration.id === 'microsoft-teams') {
        const { data, error } = await supabase.functions.invoke('microsoft-teams', {
          body: { action: 'list-sites' },
        });
        testSuccess = !error && data;
      }

      // Update test status in database
      await supabase
        .from('integration_settings' as any)
        .upsert({
          integration_id: integration.id,
          is_active: integration.isActive,
          test_status: testSuccess ? 'success' : 'error',
          last_tested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'integration_id',
        });

      setIntegrations(prev => prev.map(i =>
        i.id === integration.id 
          ? { ...i, testStatus: testSuccess ? 'success' : 'error', lastTested: new Date() }
          : i
      ));

      if (testSuccess) {
        toast.success(`Conexão com ${integration.name} funcionando`);
      } else {
        toast.error(`Falha na conexão com ${integration.name}`);
      }
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error(`Erro ao testar ${integration.name}`);
      
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { ...i, testStatus: 'error', lastTested: new Date() }
          : i
      ));
    } finally {
      setTestingId(null);
    }
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isSocio) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas sócios podem acessar as configurações de integrações.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const groupedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  const activeCount = integrations.filter(i => i.isActive).length;
  const successCount = integrations.filter(i => i.testStatus === 'success').length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="h-8 w-8 text-primary" />
            Integrações
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as integrações da intranet com sistemas externos
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{integrations.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Integrações</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{successCount}</p>
                  <p className="text-sm text-muted-foreground">Testadas com Sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integrations by Category */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          Object.entries(groupedIntegrations).map(([category, categoryIntegrations]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Badge className={CATEGORY_COLORS[category]}>
                  {CATEGORY_LABELS[category]}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryIntegrations.map(integration => (
                  <Card key={integration.id} className={!integration.isActive ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${integration.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {integration.icon}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                            <CardDescription className="text-sm">
                              {integration.description}
                            </CardDescription>
                          </div>
                        </div>
                        <Switch
                          checked={integration.isActive}
                          onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {integration.testStatus === 'success' && (
                            <Badge variant="outline" className="text-green-500 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Conectado
                            </Badge>
                          )}
                          {integration.testStatus === 'error' && (
                            <Badge variant="outline" className="text-red-500 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Erro
                            </Badge>
                          )}
                          {!integration.testStatus && (
                            <Badge variant="outline" className="text-muted-foreground">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Não testado
                            </Badge>
                          )}
                        </div>
                        {integration.testEndpoint && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testIntegration(integration)}
                            disabled={testingId === integration.id || !integration.isActive}
                          >
                            {testingId === integration.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Testar
                          </Button>
                        )}
                      </div>
                      {integration.lastTested && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Último teste: {integration.lastTested.toLocaleString('pt-BR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
