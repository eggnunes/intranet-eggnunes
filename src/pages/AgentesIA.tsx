import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatGPTAgentsTab } from '@/components/agents/ChatGPTAgentsTab';
import { IntranetAgentsTab } from '@/components/agents/IntranetAgentsTab';
import { ExternalLink, Server, History } from 'lucide-react';
import { AgentUsageHistory } from '@/components/agents/AgentUsageHistory';

export default function AgentesIA() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Agentes de IA
          </h1>
          <p className="text-muted-foreground mt-2">
            Assistentes inteligentes para otimizar seu trabalho jurídico
          </p>
        </div>

        <Tabs defaultValue="intranet" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="intranet" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Agentes da Intranet
            </TabsTrigger>
            <TabsTrigger value="chatgpt" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Agentes do ChatGPT
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Uso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intranet">
            <IntranetAgentsTab />
          </TabsContent>

          <TabsContent value="chatgpt">
            <ChatGPTAgentsTab />
          </TabsContent>

          <TabsContent value="historico">
            <AgentUsageHistory />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
