import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileText, Target, ShieldAlert, Package, GitCompare, Settings } from 'lucide-react';
import { UTMGenerator } from '@/components/UTMGenerator';
import { LeadFormsManager } from '@/components/LeadFormsManager';
import { LeadsDashboard } from '@/components/LeadsDashboard';
import { LandingPageProductMappings } from '@/components/LandingPageProductMappings';
import { LeadCampaignComparison } from '@/components/LeadCampaignComparison';
import { WhatsAppWebhookInfo } from '@/components/WhatsAppWebhookInfo';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

export default function LeadTracking() {
  const { canView, loading } = useAdminPermissions();

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!canView('lead_tracking')) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Acesso Restrito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta página. 
                Esta funcionalidade está disponível apenas para sócios.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Tracking de Leads
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie formulários de captura, acompanhe leads e configure integrações
          </p>
        </div>

        <Tabs defaultValue="forms" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="forms" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Formulários</span>
              <span className="sm:hidden">Forms</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Leads</span>
              <span className="sm:hidden">Leads</span>
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Comparar</span>
              <span className="sm:hidden">Comp</span>
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">URL → Produto</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forms">
            <LeadFormsManager />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsDashboard />
          </TabsContent>

          <TabsContent value="compare">
            <LeadCampaignComparison />
          </TabsContent>

          <TabsContent value="mappings">
            <LandingPageProductMappings />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <UTMGenerator />
              <WhatsAppWebhookInfo />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
