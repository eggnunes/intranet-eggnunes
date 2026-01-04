import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Download, Upload, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroDashboard } from '@/components/financeiro/FinanceiroDashboard';
import { FinanceiroLancamentos } from '@/components/financeiro/FinanceiroLancamentos';
import { FinanceiroReembolsos } from '@/components/financeiro/FinanceiroReembolsos';
import { FinanceiroRelatorios } from '@/components/financeiro/FinanceiroRelatorios';
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="reembolsos">Reembolsos</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FinanceiroDashboard />
        </TabsContent>

        <TabsContent value="lancamentos">
          <FinanceiroLancamentos onNovoLancamento={() => setShowNovoLancamento(true)} />
        </TabsContent>

        <TabsContent value="reembolsos">
          <FinanceiroReembolsos />
        </TabsContent>

        <TabsContent value="relatorios">
          <FinanceiroRelatorios />
        </TabsContent>
      </Tabs>

      <NovoLancamentoDialog 
        open={showNovoLancamento} 
        onOpenChange={setShowNovoLancamento}
        onSuccess={() => {
          setShowNovoLancamento(false);
          // Trigger refresh
        }}
      />
    </div>
  );
}
