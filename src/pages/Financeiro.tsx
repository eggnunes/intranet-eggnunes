import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings, Bell, TrendingUp, Target, RefreshCw, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroDashboard } from '@/components/financeiro/FinanceiroDashboard';
import { FinanceiroLancamentos } from '@/components/financeiro/FinanceiroLancamentos';
import { FinanceiroReembolsos } from '@/components/financeiro/FinanceiroReembolsos';
import { FinanceiroRelatorios } from '@/components/financeiro/FinanceiroRelatorios';
import { FinanceiroMetas } from '@/components/financeiro/FinanceiroMetas';
import { FinanceiroRecorrencias } from '@/components/financeiro/FinanceiroRecorrencias';
import { FinanceiroFluxoCaixa } from '@/components/financeiro/FinanceiroFluxoCaixa';
import { FinanceiroAlertas } from '@/components/financeiro/FinanceiroAlertas';
import { FinanceiroConciliacao } from '@/components/financeiro/FinanceiroConciliacao';
import { NovoLancamentoDialog } from '@/components/financeiro/NovoLancamentoDialog';
import { useUserRole } from '@/hooks/useUserRole';

export default function Financeiro() {
  const navigate = useNavigate();
  const { isAdmin, profile } = useUserRole();
  const [showNovoLancamento, setShowNovoLancamento] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const isSocio = profile?.position === 'socio';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Sistema Financeiro</h1>
            <p className="text-muted-foreground">
              Gestão financeira completa do escritório
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNovoLancamento(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
          {(isAdmin || isSocio) && (
            <Button variant="outline" onClick={() => navigate('/financeiro/admin')}>
              <Settings className="h-4 w-4 mr-2" />
              Administrar
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="fluxo">
            <TrendingUp className="h-4 w-4 mr-1" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="metas">
            <Target className="h-4 w-4 mr-1" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="recorrencias">
            <RefreshCw className="h-4 w-4 mr-1" />
            Recorrências
          </TabsTrigger>
          <TabsTrigger value="conciliacao">
            <Scale className="h-4 w-4 mr-1" />
            Conciliação
          </TabsTrigger>
          <TabsTrigger value="reembolsos">Reembolsos</TabsTrigger>
          <TabsTrigger value="alertas">
            <Bell className="h-4 w-4 mr-1" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><FinanceiroDashboard /></TabsContent>
        <TabsContent value="lancamentos"><FinanceiroLancamentos onNovoLancamento={() => setShowNovoLancamento(true)} /></TabsContent>
        <TabsContent value="fluxo"><FinanceiroFluxoCaixa /></TabsContent>
        <TabsContent value="metas"><FinanceiroMetas /></TabsContent>
        <TabsContent value="recorrencias"><FinanceiroRecorrencias /></TabsContent>
        <TabsContent value="conciliacao"><FinanceiroConciliacao /></TabsContent>
        <TabsContent value="reembolsos"><FinanceiroReembolsos /></TabsContent>
        <TabsContent value="alertas"><FinanceiroAlertas /></TabsContent>
        <TabsContent value="relatorios"><FinanceiroRelatorios /></TabsContent>
      </Tabs>

      <NovoLancamentoDialog 
        open={showNovoLancamento} 
        onOpenChange={setShowNovoLancamento}
        onSuccess={() => {
          setShowNovoLancamento(false);
        }}
      />
    </div>
  );
}
