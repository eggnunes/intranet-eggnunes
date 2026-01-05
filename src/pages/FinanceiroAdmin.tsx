import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroCategoriasAdmin } from '@/components/financeiro/FinanceiroCategoriasAdmin';
import { FinanceiroContasAdmin } from '@/components/financeiro/FinanceiroContasAdmin';
import { FinanceiroClientesAdmin } from '@/components/financeiro/FinanceiroClientesAdmin';
import { FinanceiroSetoresAdmin } from '@/components/financeiro/FinanceiroSetoresAdmin';
import { FinanceiroAuditoria } from '@/components/financeiro/FinanceiroAuditoria';
import { FinanceiroMetas } from '@/components/financeiro/FinanceiroMetas';
import { FinanceiroOrcamento } from '@/components/financeiro/FinanceiroOrcamento';
import { FinanceiroIndices } from '@/components/financeiro/FinanceiroIndices';
import { FinanceiroRelatorios } from '@/components/financeiro/FinanceiroRelatorios';
import { FinanceiroPrevisoes } from '@/components/financeiro/FinanceiroPrevisoes';
import { FinanceiroRankingClientes } from '@/components/financeiro/FinanceiroRankingClientes';
import { FinanceiroContratos } from '@/components/financeiro/FinanceiroContratos';

export default function FinanceiroAdmin() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/financeiro')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Administração Financeira</h1>
          <p className="text-muted-foreground">Gerencie categorias, contas, metas, orçamentos e análises</p>
        </div>
      </div>

      <Tabs defaultValue="contratos" className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="indices">Índices</TabsTrigger>
          <TabsTrigger value="previsoes">Previsões</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos"><FinanceiroContratos /></TabsContent>
        <TabsContent value="metas"><FinanceiroMetas /></TabsContent>
        <TabsContent value="orcamento"><FinanceiroOrcamento /></TabsContent>
        <TabsContent value="indices"><FinanceiroIndices /></TabsContent>
        <TabsContent value="previsoes"><FinanceiroPrevisoes /></TabsContent>
        <TabsContent value="ranking"><FinanceiroRankingClientes /></TabsContent>
        <TabsContent value="relatorios"><FinanceiroRelatorios /></TabsContent>
        <TabsContent value="categorias"><FinanceiroCategoriasAdmin /></TabsContent>
        <TabsContent value="contas"><FinanceiroContasAdmin /></TabsContent>
        <TabsContent value="clientes"><FinanceiroClientesAdmin /></TabsContent>
        <TabsContent value="setores"><FinanceiroSetoresAdmin /></TabsContent>
        <TabsContent value="auditoria"><FinanceiroAuditoria /></TabsContent>
      </Tabs>
    </div>
  );
}
