import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText,
  Download,
  Users,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar
} from 'lucide-react';

export function FinanceiroRelatorios() {
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<string | null>(null);

  const relatorios = [
    {
      id: 'dre',
      nome: 'DRE - Demonstrativo de Resultado',
      descricao: 'Receitas, despesas e resultado do período',
      icone: TrendingUp,
      cor: 'bg-blue-500'
    },
    {
      id: 'fluxo_caixa',
      nome: 'Fluxo de Caixa',
      descricao: 'Movimentação de entrada e saída por período',
      icone: BarChart3,
      cor: 'bg-green-500'
    },
    {
      id: 'despesas_categoria',
      nome: 'Despesas por Categoria',
      descricao: 'Análise detalhada das despesas por categoria',
      icone: PieChart,
      cor: 'bg-red-500'
    },
    {
      id: 'receitas_categoria',
      nome: 'Receitas por Categoria',
      descricao: 'Análise detalhada das receitas por categoria',
      icone: PieChart,
      cor: 'bg-emerald-500'
    },
    {
      id: 'cliente_rentabilidade',
      nome: 'Rentabilidade por Cliente',
      descricao: 'Receitas, despesas e lucro por cliente',
      icone: Users,
      cor: 'bg-purple-500'
    },
    {
      id: 'reembolsos',
      nome: 'Relatório de Reembolsos',
      descricao: 'Despesas de clientes pendentes e reembolsadas',
      icone: DollarSign,
      cor: 'bg-orange-500'
    },
    {
      id: 'despesas_setor',
      nome: 'Despesas por Setor',
      descricao: 'Análise de gastos por setor do escritório',
      icone: BarChart3,
      cor: 'bg-indigo-500'
    },
    {
      id: 'comparativo_mensal',
      nome: 'Comparativo Mensal',
      descricao: 'Comparação de receitas e despesas mês a mês',
      icone: Calendar,
      cor: 'bg-cyan-500'
    }
  ];

  const gerarRelatorio = (id: string) => {
    setRelatorioSelecionado(id);
    // Em uma versão futura, isso gerará o relatório específico
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Financeiros</CardTitle>
          <CardDescription>
            Selecione um relatório para visualizar ou exportar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {relatorios.map((relatorio) => (
              <Card 
                key={relatorio.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  relatorioSelecionado === relatorio.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => gerarRelatorio(relatorio.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${relatorio.cor}`}>
                      <relatorio.icone className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{relatorio.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {relatorio.descricao}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {relatorioSelecionado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {relatorios.find(r => r.id === relatorioSelecionado)?.nome}
                </CardTitle>
                <CardDescription>
                  Configure os parâmetros do relatório
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select defaultValue="mes_atual">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_atual">Mês Atual</SelectItem>
                    <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                    <SelectItem value="trimestre">Último Trimestre</SelectItem>
                    <SelectItem value="semestre">Último Semestre</SelectItem>
                    <SelectItem value="ano">Ano Atual</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button>
                  Gerar Relatório
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-16 border-2 border-dashed rounded-lg">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Configure e gere o relatório</p>
                <p className="text-sm">
                  Selecione o período e clique em "Gerar Relatório"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
