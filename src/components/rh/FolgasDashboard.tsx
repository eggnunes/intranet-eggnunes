import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Calendar, Users, Award, TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Folga {
  id: string;
  colaborador_id: string;
  data_folga: string;
  motivo: string | null;
  colaborador_nome?: string;
}

interface FolgasDashboardProps {
  folgas: Folga[];
  loading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 80%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(0, 65%, 55%)',
  'hsl(180, 50%, 45%)',
];

export function FolgasDashboard({ folgas, loading }: FolgasDashboardProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const folgasAnoAtual = useMemo(() =>
    folgas.filter(f => new Date(f.data_folga).getFullYear() === currentYear),
    [folgas, currentYear]
  );

  const folgasMesAtual = useMemo(() =>
    folgasAnoAtual.filter(f => new Date(f.data_folga).getMonth() === currentMonth),
    [folgasAnoAtual, currentMonth]
  );

  const colaboradorMaisFolgas = useMemo(() => {
    const counts: Record<string, { nome: string; count: number }> = {};
    folgasAnoAtual.forEach(f => {
      const id = f.colaborador_id;
      if (!counts[id]) counts[id] = { nome: f.colaborador_nome || 'Desconhecido', count: 0 };
      counts[id].count++;
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [folgasAnoAtual]);

  const motivoMaisFrequente = useMemo(() => {
    const counts: Record<string, number> = {};
    folgasAnoAtual.forEach(f => {
      const motivo = f.motivo || 'Sem motivo';
      counts[motivo] = (counts[motivo] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] || null;
  }, [folgasAnoAtual]);

  // Monthly trend - last 12 months
  const dadosMensais = useMemo(() => {
    const months: { mes: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM/yy', { locale: ptBR });
      const count = folgas.filter(f => f.data_folga.startsWith(key)).length;
      months.push({ mes: label, total: count });
    }
    return months;
  }, [folgas]);

  // Distribution by motivo
  const dadosMotivo = useMemo(() => {
    const counts: Record<string, number> = {};
    folgasAnoAtual.forEach(f => {
      const motivo = f.motivo || 'Sem motivo';
      counts[motivo] = (counts[motivo] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [folgasAnoAtual]);

  // Ranking by collaborator
  const dadosRanking = useMemo(() => {
    const counts: Record<string, { nome: string; total: number }> = {};
    folgasAnoAtual.forEach(f => {
      const id = f.colaborador_id;
      if (!counts[id]) counts[id] = { nome: f.colaborador_nome || 'Desconhecido', total: 0 };
      counts[id].total++;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [folgasAnoAtual]);

  if (loading) {
    return <p className="text-center py-8 text-muted-foreground">Carregando dashboard...</p>;
  }

  const chartConfigMensal = { total: { label: 'Folgas', color: 'hsl(var(--primary))' } };
  const chartConfigRanking = { total: { label: 'Folgas', color: 'hsl(var(--primary))' } };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Folgas no Ano</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{folgasAnoAtual.length}</div>
            <p className="text-xs text-muted-foreground">Ano {currentYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Folgas no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{folgasMesAtual.length}</div>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'MMMM yyyy', { locale: ptBR })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mais Folgas (Ano)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{colaboradorMaisFolgas?.nome || '-'}</div>
            <p className="text-xs text-muted-foreground">{colaboradorMaisFolgas ? `${colaboradorMaisFolgas.count} folgas` : 'Sem dados'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Motivo Frequente</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{motivoMaisFrequente?.[0] || '-'}</div>
            <p className="text-xs text-muted-foreground">{motivoMaisFrequente ? `${motivoMaisFrequente[1]} ocorrências` : 'Sem dados'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Folgas por Mês (Últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosMensais.some(d => d.total > 0) ? (
              <ChartContainer config={chartConfigMensal} className="h-[280px] w-full">
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-center py-12 text-muted-foreground text-sm">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        {/* Pie chart by motivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Motivo ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosMotivo.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosMotivo}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {dadosMotivo.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground text-sm">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        {/* Ranking horizontal bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ranking de Colaboradores ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosRanking.length > 0 ? (
              <ChartContainer config={chartConfigRanking} className="h-[300px] w-full">
                <BarChart data={dadosRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="nome" type="category" width={150} fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-center py-12 text-muted-foreground text-sm">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
