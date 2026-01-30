import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroMenus } from '@/components/financeiro/FinanceiroMenus';
import { FinanceiroExecutivoDashboard } from '@/components/financeiro/FinanceiroExecutivoDashboard';
import { FinanceiroLancamentos } from '@/components/financeiro/FinanceiroLancamentos';
import { FinanceiroReembolsos } from '@/components/financeiro/FinanceiroReembolsos';
import { FinanceiroRelatorios } from '@/components/financeiro/FinanceiroRelatorios';
import { FinanceiroMetas } from '@/components/financeiro/FinanceiroMetas';
import { FinanceiroRecorrencias } from '@/components/financeiro/FinanceiroRecorrencias';
import { FinanceiroFluxoCaixa } from '@/components/financeiro/FinanceiroFluxoCaixa';
import { FinanceiroAlertas } from '@/components/financeiro/FinanceiroAlertas';
import { FinanceiroConciliacao } from '@/components/financeiro/FinanceiroConciliacao';
import { FinanceiroImportacaoBancaria } from '@/components/financeiro/FinanceiroImportacaoBancaria';
import { FinanceiroOrcamento } from '@/components/financeiro/FinanceiroOrcamento';
import { FinanceiroAprovacoes } from '@/components/financeiro/FinanceiroAprovacoes';
import { FinanceiroPrevisoes } from '@/components/financeiro/FinanceiroPrevisoes';
import { FinanceiroAnaliseClientes } from '@/components/financeiro/FinanceiroAnaliseClientes';
import { FinanceiroAnaliseSetores } from '@/components/financeiro/FinanceiroAnaliseSetores';
import { NovoLancamentoDialog } from '@/components/financeiro/NovoLancamentoDialog';
import { useFinanceiroKeyboardShortcuts, KeyboardShortcutsLegend } from '@/components/financeiro/FinanceiroKeyboardShortcuts';
import { AdvboxFinancialSync } from '@/components/financeiro/AdvboxFinancialSync';
import { useUserRole } from '@/hooks/useUserRole';

export default function Financeiro() {
  const navigate = useNavigate();
  const { isAdmin, profile } = useUserRole();
  const [showNovoLancamento, setShowNovoLancamento] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSocio = profile?.position === 'socio';

  // Atalhos de teclado
  useFinanceiroKeyboardShortcuts({
    onNovoLancamento: () => setShowNovoLancamento(true),
    onRefresh: () => window.location.reload(),
    onExport: () => {
      // O componente ativo vai tratar a exportação
    },
    onSearch: () => {
      searchInputRef.current?.focus();
    }
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <FinanceiroExecutivoDashboard />;
      case 'lancamentos':
        return <FinanceiroLancamentos onNovoLancamento={() => setShowNovoLancamento(true)} />;
      case 'clientes':
        return <FinanceiroAnaliseClientes />;
      case 'setores':
        return <FinanceiroAnaliseSetores />;
      case 'fluxo':
        return <FinanceiroFluxoCaixa />;
      case 'previsoes':
        return <FinanceiroPrevisoes />;
      case 'orcamento':
        return <FinanceiroOrcamento />;
      case 'metas':
        return <FinanceiroMetas />;
      case 'recorrencias':
        return <FinanceiroRecorrencias />;
      case 'aprovacoes':
        return <FinanceiroAprovacoes />;
      case 'importacao':
        return <FinanceiroImportacaoBancaria />;
      case 'conciliacao':
        return <FinanceiroConciliacao />;
      case 'sync-advbox':
        return <AdvboxFinancialSync />;
      case 'reembolsos':
        return <FinanceiroReembolsos />;
      case 'alertas':
        return <FinanceiroAlertas />;
      case 'relatorios':
        return <FinanceiroRelatorios />;
      default:
        return <FinanceiroExecutivoDashboard />;
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Sistema Financeiro</h1>
                <p className="text-sm text-muted-foreground">
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
        </div>
      </div>

      {/* Layout com menu lateral */}
      <div className="flex">
        {/* Menu Lateral */}
        <aside className="hidden lg:block sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
          <FinanceiroMenus activeTab={activeTab} onTabChange={setActiveTab} />
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 p-6">
          {/* Menu mobile/tablet */}
          <div className="lg:hidden mb-6">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
            >
              <optgroup label="Visão Geral">
                <option value="dashboard">Dashboard Executivo</option>
                <option value="fluxo">Fluxo de Caixa</option>
                <option value="previsoes">Previsões IA</option>
              </optgroup>
              <optgroup label="Movimentações">
                <option value="lancamentos">Lançamentos</option>
                <option value="recorrencias">Recorrências</option>
                <option value="reembolsos">Reembolsos</option>
                <option value="aprovacoes">Aprovações</option>
              </optgroup>
              <optgroup label="Análises">
                <option value="clientes">Por Cliente</option>
                <option value="setores">Por Setor</option>
                <option value="relatorios">Relatórios</option>
              </optgroup>
              <optgroup label="Planejamento">
                <option value="metas">Metas</option>
                <option value="orcamento">Orçamento</option>
              </optgroup>
              <optgroup label="Operações">
                <option value="importacao">Importar Extrato</option>
                <option value="conciliacao">Conciliação</option>
                <option value="sync-advbox">Sincronizar ADVBox</option>
              </optgroup>
              <option value="alertas">Alertas</option>
            </select>
          </div>

          {renderContent()}
        </main>
      </div>

      {/* Legenda de atalhos */}
      <KeyboardShortcutsLegend />

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
