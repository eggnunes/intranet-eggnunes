import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, BarChart3, FileText, Target } from 'lucide-react';
import { UTMGenerator } from '@/components/UTMGenerator';
import { LeadFormsManager } from '@/components/LeadFormsManager';
import { LeadsDashboard } from '@/components/LeadsDashboard';

export default function LeadTracking() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Tracking de Leads
          </h1>
          <p className="text-muted-foreground mt-2">
            Gere URLs de campanha e gerencie formulários de captura de leads
          </p>
        </div>

        <Tabs defaultValue="utm" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="utm" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Gerador UTM</span>
              <span className="sm:hidden">UTM</span>
            </TabsTrigger>
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
          </TabsList>

          <TabsContent value="utm">
            <UTMGenerator />
          </TabsContent>

          <TabsContent value="forms">
            <LeadFormsManager />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
