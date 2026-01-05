import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ParceirosList, ParceirosAreasManager, ParceirosRanking } from '@/components/parceiros';
import { Users, Settings, Trophy } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export default function Parceiros() {
  const [activeTab, setActiveTab] = useState('parceiros');
  const { isAdmin } = useUserRole();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Parceiros</h1>
          <p className="text-muted-foreground">
            Gerencie parceiros de indicação de causas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="parceiros">
              <Users className="h-4 w-4 mr-2" />
              Parceiros
            </TabsTrigger>
            <TabsTrigger value="ranking">
              <Trophy className="h-4 w-4 mr-2" />
              Ranking
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="areas">
                <Settings className="h-4 w-4 mr-2" />
                Áreas de Atuação
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="parceiros" className="mt-6">
            <ParceirosList />
          </TabsContent>

          <TabsContent value="ranking" className="mt-6">
            <ParceirosRanking />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="areas" className="mt-6">
              <ParceirosAreasManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
