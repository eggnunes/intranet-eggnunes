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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmilePlus, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MOODS = [
  { value: 'muito_bom', label: 'Muito Bom', emoji: '😄', score: 5, color: 'hsl(142, 76%, 36%)' },
  { value: 'bom', label: 'Bom', emoji: '🙂', score: 4, color: 'hsl(142, 76%, 50%)' },
  { value: 'neutro', label: 'Neutro', emoji: '😐', score: 3, color: 'hsl(48, 96%, 53%)' },
  { value: 'ruim', label: 'Ruim', emoji: '😟', score: 2, color: 'hsl(25, 95%, 53%)' },
  { value: 'muito_ruim', label: 'Muito Ruim', emoji: '😢', score: 1, color: 'hsl(0, 84%, 60%)' },
] as const;

const getMoodInfo = (mood: string) => MOODS.find(m => m.value === mood) || MOODS[2];

const PesquisaHumor = () => {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [filtroPosition, setFiltroPosition] = useState<string>('all');
  const isGestor = isAdmin || profile?.position === 'socio';

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

  // All moods for gestors (last 30 days)
  const { data: allMoods = [] } = useQuery({
    queryKey: ['mood-all', isGestor],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await (supabase as any)
        .from('mood_surveys')
        .select('*, profiles:user_id(full_name, position)')
        .gte('created_at', since)
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

  // Aggregated data for gestors
  const aggregatedData = useMemo(() => {
    const filtered = filtroPosition === 'all'
      ? allMoods
      : allMoods.filter((m: any) => m.profiles?.position === filtroPosition);

    const counts: Record<string, number> = {};
    MOODS.forEach(m => { counts[m.value] = 0; });
    filtered.forEach((m: any) => { counts[m.mood] = (counts[m.mood] || 0) + 1; });

    return MOODS.map(m => ({
      name: `${m.emoji} ${m.label}`,
      value: counts[m.value],
      color: m.color,
    }));
  }, [allMoods, filtroPosition]);

  // Low mood alerts (last 7 days)
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
            {/* Line chart */}
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

            {/* Table */}
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
              {/* Filters */}
              <div className="flex items-center gap-4">
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

              {/* Bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Humor (últimos 30 dias)</CardTitle>
                  <CardDescription>Visão agregada de todas as respostas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={aggregatedData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="Respostas" radius={[4, 4, 0, 0]}>
                        {aggregatedData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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

              {/* Detailed table */}
              <Card>
                <CardHeader>
                  <CardTitle>Registros Detalhados</CardTitle>
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
                      {(filtroPosition === 'all'
                        ? allMoods
                        : allMoods.filter((m: any) => m.profiles?.position === filtroPosition)
                      ).map((entry: any) => {
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
                      {allMoods.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">Sem registros</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
