import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionDashboard } from '@/components/CollectionDashboard';
import { CollectionRulesManager } from '@/components/CollectionRulesManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CollectionManagement() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Gestão de Cobranças</h1>
          <p className="text-muted-foreground">
            Acompanhe e configure o sistema de cobranças automáticas
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="rules">Regras Automáticas</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CollectionDashboard />
        </TabsContent>

        <TabsContent value="rules">
          <CollectionRulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}