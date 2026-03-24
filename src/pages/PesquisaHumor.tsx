import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth, setMonth, setYear, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmilePlus, AlertTriangle, TrendingUp, Users, Calendar, MessageSquare, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

const MOODS = [
  { value: 'muito_bom', label: 'Muito Bom', emoji: '😄', score: 5, color: 'hsl(142, 76%, 36%)' },
  { value: 'bom', label: 'Bom', emoji: '🙂', score: 4, color: 'hsl(142, 76%, 50%)' },
  { value: 'neutro', label: 'Neutro', emoji: '😐', score: 3, color: 'hsl(48, 96%, 53%)' },
  { value: 'ruim', label: 'Ruim', emoji: '😟', score: 2, color: 'hsl(25, 95%, 53%)' },
  { value: 'muito_ruim', label: 'Muito Ruim', emoji: '😢', score: 1, color: 'hsl(0, 84%, 60%)' },
] as const;

const getMoodInfo = (mood: string) => MOODS.find(m => m.value === mood) || MOODS[2];

const POSITION_LABELS: Record<string, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
};

const getScoreLabel = (score: number) => {
  if (score >= 4.5) return { text: 'Excelente', color: 'text-green-600' };
  if (score >= 3.5) return { text: 'Bom', color: 'text-emerald-500' };
  if (score >= 2.5) return { text: 'Regular', color: 'text-yellow-500' };
  if (score >= 1.5) return { text: 'Ruim', color: 'text-orange-500' };
  return { text: 'Crítico', color: 'text-red-500' };
};

const PesquisaHumor = () => {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [filtroPosition, setFiltroPosition] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const isGestor = isAdmin || profile?.position === 'socio';

  const periodStart = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    return format(startOfMonth(d), 'yyyy-MM-dd');
  }, [selectedMonth, selectedYear]);

  const periodEnd = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    return format(endOfMonth(d), 'yyyy-MM-dd');
  }, [selectedMonth, selectedYear]);

  const periodLabel = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    return format(d, 'MMMM yyyy', { locale: ptBR });
  }, [selectedMonth, selectedYear]);

  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // Check if already answered today
  const { data: todayEntry } = useQuery({
    queryKey: ['mood-today', user?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await (supabase as any)
        .from('mood_surveys')
        .select('*')
        .eq('user_id', user!.id)
        .eq('survey_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Personal history (last 30 days)
  const { data: myHistory = [] } = useQuery({
    queryKey: ['mood-history', user?.id],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await (supabase as any)
        .from('mood_surveys')
        .select('*, profiles:user_id(full_name)')
        .eq('user_id', user!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  // All moods for gestors (filtered by selected month)
  const { data: allMoods = [] } = useQuery({
    queryKey: ['mood-all', isGestor, periodStart, periodEnd],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('mood_surveys')
        .select('*, profiles:user_id(full_name, position)')
        .gte('survey_date', periodStart)
        .lte('survey_date', periodEnd)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: isGestor,
  });

  const submitMood = useMutation({
    mutationFn: async () => {
      if (!selectedMood || !user) throw new Error('Selecione um humor');
      const { error } = await (supabase as any).from('mood_surveys').insert({
        user_id: user.id,
        mood: selectedMood,
        observacoes: observacoes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Humor registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['mood-today'] });
      queryClient.invalidateQueries({ queryKey: ['mood-history'] });
      queryClient.invalidateQueries({ queryKey: ['mood-all'] });
      setDialogOpen(false);
      setSelectedMood(null);
      setObservacoes('');
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        toast.error('Você já registrou seu humor hoje.');
      } else {
        toast.error('Erro ao registrar humor.');
      }
    },
  });

  // Chart data for personal history
  const chartData = useMemo(() =>
    myHistory.map((entry: any) => ({
      date: format(new Date(entry.created_at), 'dd/MM'),
      score: getMoodInfo(entry.mood).score,
      mood: getMoodInfo(entry.mood).label,
    })),
    [myHistory]
  );

  // Filtered moods based on position filter
  const filteredMoods = useMemo(() => {
    return filtroPosition === 'all'
      ? allMoods
      : allMoods.filter((m: any) => m.profiles?.position === filtroPosition);
  }, [allMoods, filtroPosition]);

  // Cycle metrics
  const cycleMetrics = useMemo(() => {
    const uniqueUsers = new Set(filteredMoods.map((m: any) => m.user_id));
    const uniqueDays = new Set(filteredMoods.map((m: any) => m.survey_date));
    const totalResponses = filteredMoods.length;
    const avgScore = totalResponses > 0
      ? filteredMoods.reduce((sum: number, m: any) => sum + getMoodInfo(m.mood).score, 0) / totalResponses
      : 0;
    return {
      collaborators: uniqueUsers.size,
      activeDays: uniqueDays.size,
      totalResponses,
      avgScore: Math.round(avgScore * 10) / 10,
      scoreInfo: getScoreLabel(avgScore),
    };
  }, [filteredMoods]);

  // Mood counts for cards
  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MOODS.forEach(m => { counts[m.value] = 0; });
    filteredMoods.forEach((m: any) => { counts[m.mood] = (counts[m.mood] || 0) + 1; });
    const total = filteredMoods.length || 1;
    return MOODS.map(m => ({
      ...m,
      count: counts[m.value],
      percentage: Math.round((counts[m.value] / total) * 100),
    }));
  }, [filteredMoods]);

  // Pie chart data
  const pieData = useMemo(() =>
    moodCounts.filter(m => m.count > 0).map(m => ({
      name: m.label,
      value: m.count,
      fill: m.color,
    })),
    [moodCounts]
  );

  // Radar data — score by department
  const radarData = useMemo(() => {
    const deptScores: Record<string, { total: number; count: number }> = {};
    filteredMoods.forEach((m: any) => {
      const pos = m.profiles?.position || 'outro';
      if (!deptScores[pos]) deptScores[pos] = { total: 0, count: 0 };
      deptScores[pos].total += getMoodInfo(m.mood).score;
      deptScores[pos].count++;
    });
    return Object.entries(deptScores).map(([pos, data]) => ({
      department: POSITION_LABELS[pos] || pos,
      score: Math.round((data.total / data.count) * 10) / 10,
      fullMark: 5,
    }));
  }, [filteredMoods]);

  // Stacked bar — mood by department
  const deptStackedData = useMemo(() => {
    const deptMap: Record<string, Record<string, number>> = {};
    filteredMoods.forEach((m: any) => {
      const pos = m.profiles?.position || 'outro';
      const label = POSITION_LABELS[pos] || pos;
      if (!deptMap[label]) {
        deptMap[label] = {};
        MOODS.forEach(mood => { deptMap[label][mood.label] = 0; });
      }
      deptMap[label][getMoodInfo(m.mood).label]++;
    });
    return Object.entries(deptMap).map(([dept, moods]) => ({ department: dept, ...moods }));
  }, [filteredMoods]);

  // Daily evolution stacked bar
  const dailyEvolution = useMemo(() => {
    const dayMap: Record<string, Record<string, number>> = {};
    filteredMoods.forEach((m: any) => {
      const day = m.survey_date;
      if (!dayMap[day]) {
        dayMap[day] = {};
        MOODS.forEach(mood => { dayMap[day][mood.label] = 0; });
      }
      dayMap[day][getMoodInfo(m.mood).label]++;
    });
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, moods]) => ({
        day: format(new Date(day + 'T12:00:00'), 'dd/MM'),
        ...moods,
      }));
  }, [filteredMoods]);

  // Timeline grouped by day
  const timelineGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredMoods.forEach((m: any) => {
      const day = m.survey_date;
      if (!groups[day]) groups[day] = [];
      groups[day].push(m);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, entries]) => ({
        date: day,
        label: format(new Date(day + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR }),
        count: entries.length,
        entries,
      }));
  }, [filteredMoods]);

  // Low mood alerts (last 7 days from allMoods — unfiltered)
  const lowMoodAlerts = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recent = allMoods.filter((m: any) =>
      new Date(m.created_at) >= sevenDaysAgo &&
      (m.mood === 'ruim' || m.mood === 'muito_ruim')
    );
    const byUser: Record<string, { name: string; count: number; moods: string[] }> = {};
    recent.forEach((m: any) => {
      const name = m.profiles?.full_name || 'Desconhecido';
      if (!byUser[m.user_id]) byUser[m.user_id] = { name, count: 0, moods: [] };
      byUser[m.user_id].count++;
      byUser[m.user_id].moods.push(getMoodInfo(m.mood).emoji);
    });
    return Object.values(byUser).sort((a, b) => b.count - a.count);
  }, [allMoods]);

  // Aggregated data (kept for compatibility)
  const aggregatedData = useMemo(() =>
    MOODS.map(m => ({
      name: `${m.emoji} ${m.label}`,
      value: moodCounts.find(mc => mc.value === m.value)?.count || 0,
      color: m.color,
    })),
    [moodCounts]
  );

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pesquisa de Humor</h1>
            <p className="text-muted-foreground">Registre como você está se sentindo</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} disabled={!!todayEntry}>
            <SmilePlus className="h-4 w-4 mr-2" />
            {todayEntry ? 'Já registrado hoje' : 'Registrar Humor'}
          </Button>
        </div>

        {todayEntry && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Seu humor de hoje:</p>
              <p className="text-2xl mt-1">
                {getMoodInfo(todayEntry.mood).emoji} {getMoodInfo(todayEntry.mood).label}
              </p>
              {todayEntry.observacoes && (
                <p className="text-sm text-muted-foreground mt-2">"{todayEntry.observacoes}"</p>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Meu Histórico</TabsTrigger>
            {isGestor && <TabsTrigger value="gestao">Visão Geral</TabsTrigger>}
          </TabsList>

          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> Tendência (últimos 30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v) => MOODS.find(m => m.score === v)?.emoji || ''} />
                      <Tooltip formatter={(value: number) => [MOODS.find(m => m.score === value)?.label, 'Humor']} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhum registro ainda. Registre seu humor!</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registros</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Humor</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...myHistory].reverse().map((entry: any) => {
                      const info = getMoodInfo(entry.mood);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.profiles?.full_name || '—'}</TableCell>
                          <TableCell>{format(new Date(entry.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{info.emoji} {info.label}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{entry.observacoes || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {myHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">Sem registros</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {isGestor && (
            <TabsContent value="gestao" className="space-y-6">
              {/* Month selector + position filter */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-card border rounded-lg px-2 py-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium capitalize min-w-[140px] text-center">{periodLabel}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Select value={filtroPosition} onValueChange={setFiltroPosition}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrar por cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="socio">Sócio</SelectItem>
                    <SelectItem value="advogado">Advogado</SelectItem>
                    <SelectItem value="estagiario">Estagiário</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cycle header */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold text-foreground">{cycleMetrics.collaborators}</p>
                    <p className="text-xs text-muted-foreground">Colaboradores</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold text-foreground">{cycleMetrics.activeDays}</p>
                    <p className="text-xs text-muted-foreground">Dias com Registro</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <MessageSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold text-foreground">{cycleMetrics.totalResponses}</p>
                    <p className="text-xs text-muted-foreground">Total de Respostas</p>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="pt-4 pb-4 text-center">
                    <Star className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold text-foreground">
                      {cycleMetrics.avgScore > 0 ? cycleMetrics.avgScore : '—'}
                      <span className="text-base font-normal text-muted-foreground">/5</span>
                    </p>
                    {cycleMetrics.avgScore > 0 && (
                      <p className={`text-sm font-semibold ${cycleMetrics.scoreInfo.color}`}>
                        {cycleMetrics.scoreInfo.text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Score Médio</p>
                  </CardContent>
                </Card>
              </div>

              {/* Mood count cards with progress bars */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {moodCounts.map(m => (
                  <Card key={m.value}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{m.emoji}</span>
                        <div>
                          <p className="text-lg font-bold text-foreground">{m.count}</p>
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                        </div>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${m.percentage}%`, backgroundColor: m.color }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-right">{m.percentage}%</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Charts row: Pie + Radar */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição Geral</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%" cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={110}
                            dataKey="value"
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Score por Departamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="department" className="text-xs" />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} />
                          <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Sem dados no período</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Mood by department — horizontal stacked bar */}
              {deptStackedData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Humor por Departamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(200, deptStackedData.length * 60)}>
                      <BarChart data={deptStackedData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" />
                        <YAxis dataKey="department" type="category" width={100} className="text-xs" />
                        <Tooltip />
                        <Legend />
                        {MOODS.map(m => (
                          <Bar key={m.value} dataKey={m.label} stackId="a" fill={m.color} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Daily evolution — vertical stacked bar */}
              {dailyEvolution.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Evolução Diária</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={dailyEvolution}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="day" className="text-xs" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {MOODS.map(m => (
                          <Bar key={m.value} dataKey={m.label} stackId="a" fill={m.color} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Alerts */}
              {lowMoodAlerts.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" /> Alertas de Humor Baixo (últimos 7 dias)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {lowMoodAlerts.map((alert, i) => (
                        <Card key={i} className="border-destructive/20 bg-destructive/5">
                          <CardContent className="pt-4">
                            <p className="font-medium text-foreground">{alert.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {alert.count} registro(s) negativo(s) — {alert.moods.join(' ')}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Registros por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineGroups.length > 0 ? (
                    <div className="space-y-6">
                      {timelineGroups.map(group => (
                        <div key={group.date}>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-sm font-semibold capitalize text-foreground">{group.label}</h3>
                            <Badge variant="secondary" className="text-xs">{group.count} registro(s)</Badge>
                          </div>
                          <div className="space-y-2 ml-2 border-l-2 border-border pl-4">
                            {group.entries.map((entry: any) => {
                              const info = getMoodInfo(entry.mood);
                              return (
                                <div key={entry.id} className="flex items-start gap-3 py-2">
                                  <div
                                    className="flex items-center justify-center w-9 h-9 rounded-full text-lg shrink-0"
                                    style={{ backgroundColor: info.color + '30' }}
                                  >
                                    {info.emoji}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm text-foreground">
                                        {entry.profiles?.full_name || '—'}
                                      </span>
                                      {entry.profiles?.position && (
                                        <Badge variant="outline" className="text-xs">
                                          {POSITION_LABELS[entry.profiles.position] || entry.profiles.position}
                                        </Badge>
                                      )}
                                    </div>
                                    {entry.observacoes && (
                                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                        "{entry.observacoes}"
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="shrink-0">{info.emoji} {info.label}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">Sem registros no período</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Dialog for registering mood */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Como está seu humor hoje?</DialogTitle>
              <DialogDescription>Selecione a opção que melhor descreve como você se sente agora.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-5 gap-2 py-4">
              {MOODS.map(mood => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    selectedMood === mood.value
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-3xl">{mood.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{mood.label}</span>
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Observações (opcional)"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={3}
            />
            <Button
              onClick={() => submitMood.mutate()}
              disabled={!selectedMood || submitMood.isPending}
              className="w-full"
            >
              {submitMood.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PesquisaHumor;
