import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Scale, MapPin, Award, Target } from 'lucide-react';

interface Decision {
  id: string;
  decision_type: string;
  product_name: string;
  client_name: string;
  court: string | null;
  decision_date: string;
  materia: string | null;
  resultado: string | null;
  regiao: string | null;
  reu: string | null;
  created_at: string;
}

const MATERIA_LABELS: Record<string, string> = {
  civil: 'Civil',
  trabalhista: 'Trabalhista',
  previdenciario: 'Previdenciário',
  tributario: 'Tributário',
  administrativo: 'Administrativo',
  consumidor: 'Consumidor',
  imobiliario: 'Imobiliário',
  servidor_publico: 'Servidor Público',
  outro: 'Outro',
};

const RESULTADO_LABELS: Record<string, string> = {
  procedente: 'Procedente',
  improcedente: 'Improcedente',
  parcialmente_procedente: 'Parcialmente Procedente',
  nao_identificado: 'Não Identificado',
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(24, 95%, 53%)',
  'hsl(47, 95%, 53%)',
  'hsl(346, 77%, 50%)',
  'hsl(173, 58%, 39%)',
];

interface JurimetriaDashboardProps {
  decisions: Decision[];
}

export function JurimetriaDashboard({ decisions }: JurimetriaDashboardProps) {
  const [filterMateria, setFilterMateria] = useState('all');
  const [filterRegiao, setFilterRegiao] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  const filtered = useMemo(() => {
    return decisions.filter(d => {
      if (filterMateria !== 'all' && d.materia !== filterMateria) return false;
      if (filterRegiao !== 'all' && d.regiao !== filterRegiao) return false;
      if (filterDateStart && d.decision_date < filterDateStart) return false;
      if (filterDateEnd && d.decision_date > filterDateEnd) return false;
      return true;
    });
  }, [decisions, filterMateria, filterRegiao, filterDateStart, filterDateEnd]);

  const uniqueRegioes = useMemo(() => {
    return [...new Set(decisions.map(d => d.regiao).filter(Boolean))] as string[];
  }, [decisions]);

  const uniqueMaterias = useMemo(() => {
    return [...new Set(decisions.map(d => d.materia).filter(Boolean))] as string[];
  }, [decisions]);

  // KPIs
  const totalDecisions = filtered.length;
  const procedentes = filtered.filter(d => d.resultado === 'procedente' || d.resultado === 'parcialmente_procedente').length;
  const taxaProcedencia = totalDecisions > 0 ? Math.round((procedentes / totalDecisions) * 100) : 0;

  const topTribunal = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.regiao || d.court || 'Não informado';
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${sorted[0][0]} (${sorted[0][1]})` : '-';
  }, [filtered]);

  const topMateria = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.materia || 'Não categorizado';
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? `${MATERIA_LABELS[sorted[0][0]] || sorted[0][0]} (${sorted[0][1]})` : '-';
  }, [filtered]);

  // Charts data
  const materiaData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.materia || 'nao_categorizado';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: MATERIA_LABELS[name] || 'Não Categorizado',
      value,
    }));
  }, [filtered]);

  const regiaoData = useMemo(() => {
    const counts: Record<string, { procedente: number; improcedente: number; total: number }> = {};
    filtered.forEach(d => {
      const key = d.regiao || d.court || 'Não informado';
      if (!counts[key]) counts[key] = { procedente: 0, improcedente: 0, total: 0 };
      counts[key].total++;
      if (d.resultado === 'procedente' || d.resultado === 'parcialmente_procedente') counts[key].procedente++;
      else counts[key].improcedente++;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
  }, [filtered]);

  const resultadoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.resultado || 'nao_identificado';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: RESULTADO_LABELS[name] || name,
      value,
    }));
  }, [filtered]);

  const timelineData = useMemo(() => {
    const months: Record<string, number> = {};
    filtered.forEach(d => {
      const month = d.decision_date?.slice(0, 7);
      if (month) months[month] = (months[month] || 0) + 1;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({
        month: month.split('-').reverse().join('/'),
        decisoes: count,
      }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm">Matéria</Label>
              <Select value={filterMateria} onValueChange={setFilterMateria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueMaterias.map(m => (
                    <SelectItem key={m} value={m}>{MATERIA_LABELS[m] || m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Região/Tribunal</Label>
              <Select value={filterRegiao} onValueChange={setFilterRegiao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueRegioes.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Data Início</Label>
              <Input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Data Fim</Label>
              <Input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{totalDecisions}</div>
              <p className="text-xs text-muted-foreground">Total Decisões</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{taxaProcedencia}%</div>
              <p className="text-xs text-muted-foreground">Taxa Procedência</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Target className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{procedentes}</div>
              <p className="text-xs text-muted-foreground">Procedentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-purple-600" />
            <div>
              <div className="text-sm font-bold truncate max-w-[120px]" title={topTribunal}>{topTribunal}</div>
              <p className="text-xs text-muted-foreground">Top Tribunal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Award className="h-8 w-8 text-orange-600" />
            <div>
              <div className="text-sm font-bold truncate max-w-[120px]" title={topMateria}>{topMateria}</div>
              <p className="text-xs text-muted-foreground">Top Matéria</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie: Matéria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Matéria</CardTitle>
          </CardHeader>
          <CardContent>
            {materiaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={materiaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {materiaData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado categorizado</p>
            )}
          </CardContent>
        </Card>

        {/* Bar: Resultado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procedência vs Improcedência</CardTitle>
          </CardHeader>
          <CardContent>
            {resultadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resultadoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Decisões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar: Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisões por Tribunal/Região</CardTitle>
          </CardHeader>
          <CardContent>
            {regiaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regiaoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="procedente" name="Procedente" stackId="a" fill="hsl(142, 76%, 36%)" />
                  <Bar dataKey="improcedente" name="Improcedente" stackId="a" fill="hsl(346, 77%, 50%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado</p>
            )}
          </CardContent>
        </Card>

        {/* Line: Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Temporal</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="decisoes" name="Decisões" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum dado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Réus */}
      {filtered.some(d => d.reu) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Réus Mais Frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const counts: Record<string, number> = {};
                filtered.forEach(d => {
                  if (d.reu) counts[d.reu] = (counts[d.reu] || 0) + 1;
                });
                return Object.entries(counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([name, count]) => (
                    <Badge key={name} variant="secondary" className="text-sm">
                      {name} ({count})
                    </Badge>
                  ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
