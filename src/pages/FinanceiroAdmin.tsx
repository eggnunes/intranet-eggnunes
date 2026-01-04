import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinanceiroCategoriasAdmin } from '@/components/financeiro/FinanceiroCategoriasAdmin';
import { FinanceiroContasAdmin } from '@/components/financeiro/FinanceiroContasAdmin';
import { FinanceiroClientesAdmin } from '@/components/financeiro/FinanceiroClientesAdmin';
import { FinanceiroSetoresAdmin } from '@/components/financeiro/FinanceiroSetoresAdmin';
import { FinanceiroAuditoria } from '@/components/financeiro/FinanceiroAuditoria';

export default function FinanceiroAdmin() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/financeiro')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Administração Financeira</h1>
          <p className="text-muted-foreground">
            Gerencie categorias, contas, clientes e configurações
          </p>
        </div>
      </div>

      <Tabs defaultValue="categorias" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias">
          <FinanceiroCategoriasAdmin />
        </TabsContent>

        <TabsContent value="contas">
          <FinanceiroContasAdmin />
        </TabsContent>

        <TabsContent value="clientes">
          <FinanceiroClientesAdmin />
        </TabsContent>

        <TabsContent value="setores">
          <FinanceiroSetoresAdmin />
        </TabsContent>

        <TabsContent value="auditoria">
          <FinanceiroAuditoria />
        </TabsContent>
      </Tabs>
    </div>
  );
}
