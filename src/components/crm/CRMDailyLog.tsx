import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Phone, Users, FileText, HandshakeIcon, UserPlus, RotateCcw, Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  calls_made: number;
  meetings_held: number;
  proposals_sent: number;
  contracts_signed: number;
  new_leads: number;
  follow_ups: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DailyLogWithProfile extends DailyLog {
  profiles?: { full_name: string } | null;
}

type ViewMode = 'form' | 'history' | 'team';

export const CRMDailyLog = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [existingLog, setExistingLog] = useState<DailyLog | null>(null);
  const [logs, setLogs] = useState<DailyLogWithProfile[]>([]);
  const [teamLogs, setTeamLogs] = useState<DailyLogWithProfile[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month'>('week');

  // Form state
  const [callsMade, setCallsMade] = useState(0);
  const [meetingsHeld, setMeetingsHeld] = useState(0);
  const [proposalsSent, setProposalsSent] = useState(0);
  const [contractsSigned, setContractsSigned] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) {
      fetchLogForDate();
      fetchHistory();
      if (isAdmin) fetchTeamLogs();
    }
  }, [user, selectedDate, periodFilter, isAdmin]);

  const fetchLogForDate = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('crm_daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', selectedDate)
      .maybeSingle();

    if (data) {
      setExistingLog(data as DailyLog);
      setCallsMade(data.calls_made);
      setMeetingsHeld(data.meetings_held);
      setProposalsSent(data.proposals_sent);
      setContractsSigned(data.contracts_signed);
      setNewLeads(data.new_leads);
      setFollowUps(data.follow_ups);
      setNotes(data.notes || '');
    } else {
      setExistingLog(null);
      resetForm();
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    if (!user) return;
    const now = new Date();
    const start = periodFilter === 'week'
      ? format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(now), 'yyyy-MM-dd');
    const end = periodFilter === 'week'
      ? format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(endOfMonth(now), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('crm_daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', start)
      .lte('log_date', end)
      .order('log_date', { ascending: false });

    setLogs((data || []) as DailyLog[]);
  };

  const fetchTeamLogs = async () => {
    const now = new Date();
    const start = periodFilter === 'week'
      ? format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfMonth(now), 'yyyy-MM-dd');
    const end = periodFilter === 'week'
      ? format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(endOfMonth(now), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('crm_daily_logs')
      .select('*, profiles(full_name)')
      .gte('log_date', start)
      .lte('log_date', end)
      .order('log_date', { ascending: false });

    setTeamLogs((data || []) as DailyLogWithProfile[]);
  };

  const resetForm = () => {
    setCallsMade(0);
    setMeetingsHeld(0);
    setProposalsSent(0);
    setContractsSigned(0);
    setNewLeads(0);
    setFollowUps(0);
    setNotes('');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      log_date: selectedDate,
      calls_made: callsMade,
      meetings_held: meetingsHeld,
      proposals_sent: proposalsSent,
      contracts_signed: contractsSigned,
      new_leads: newLeads,
      follow_ups: followUps,
      notes: notes || null,
    };

    try {
      if (existingLog) {
        const { error } = await supabase
          .from('crm_daily_logs')
          .update(payload)
          .eq('id', existingLog.id);
        if (error) throw error;
        toast.success('Registro atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('crm_daily_logs')
          .insert(payload);
        if (error) throw error;
        toast.success('Registro salvo com sucesso!');
      }
      fetchLogForDate();
      fetchHistory();
      if (isAdmin) fetchTeamLogs();
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totals = logs.reduce(
    (acc, log) => ({
      calls: acc.calls + log.calls_made,
      meetings: acc.meetings + log.meetings_held,
      proposals: acc.proposals + log.proposals_sent,
      contracts: acc.contracts + log.contracts_signed,
      leads: acc.leads + log.new_leads,
      followUps: acc.followUps + log.follow_ups,
    }),
    { calls: 0, meetings: 0, proposals: 0, contracts: 0, leads: 0, followUps: 0 }
  );

  // Chart data from history
  const chartData = [...logs].reverse().map(log => ({
    date: format(new Date(log.log_date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
    Ligações: log.calls_made,
    Reuniões: log.meetings_held,
    Propostas: log.proposals_sent,
    Contratos: log.contracts_signed,
  }));

  // Team summary
  const teamSummary = isAdmin ? Object.values(
    teamLogs.reduce((acc, log) => {
      const name = (log.profiles as any)?.full_name || 'Desconhecido';
      if (!acc[name]) {
        acc[name] = { name, calls: 0, meetings: 0, proposals: 0, contracts: 0, leads: 0, followUps: 0, days: 0 };
      }
      acc[name].calls += log.calls_made;
      acc[name].meetings += log.meetings_held;
      acc[name].proposals += log.proposals_sent;
      acc[name].contracts += log.contracts_signed;
      acc[name].leads += log.new_leads;
      acc[name].followUps += log.follow_ups;
      acc[name].days += 1;
      return acc;
    }, {} as Record<string, any>)
  ) : [];

  const StatField = ({ icon: Icon, label, value, onChange, color }: {
    icon: any; label: string; value: number; onChange: (v: number) => void; color: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          -
        </Button>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* View Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={viewMode === 'form' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('form')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Registrar
        </Button>
        <Button
          variant={viewMode === 'history' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('history')}
        >
          <TrendingUp className="h-4 w-4 mr-1" />
          Meu Histórico
        </Button>
        {isAdmin && (
          <Button
            variant={viewMode === 'team' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('team')}
          >
            <Users className="h-4 w-4 mr-1" />
            Visão da Equipe
          </Button>
        )}

        <div className="ml-auto">
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as 'week' | 'month')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* FORM VIEW */}
      {viewMode === 'form' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Registro Diário</CardTitle>
                <CardDescription>
                  {existingLog ? 'Atualize' : 'Registre'} suas atividades do dia
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate + 'T12:00:00'), -1), 'yyyy-MM-dd'))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[160px]"
                />
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {existingLog && (
              <Badge variant="secondary" className="w-fit">Registro existente — editando</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatField icon={Phone} label="Ligações" value={callsMade} onChange={setCallsMade} color="text-blue-500" />
                  <StatField icon={Users} label="Reuniões" value={meetingsHeld} onChange={setMeetingsHeld} color="text-purple-500" />
                  <StatField icon={FileText} label="Propostas" value={proposalsSent} onChange={setProposalsSent} color="text-orange-500" />
                  <StatField icon={HandshakeIcon} label="Contratos" value={contractsSigned} onChange={setContractsSigned} color="text-green-500" />
                  <StatField icon={UserPlus} label="Novos Leads" value={newLeads} onChange={setNewLeads} color="text-cyan-500" />
                  <StatField icon={RotateCcw} label="Follow-ups" value={followUps} onChange={setFollowUps} color="text-amber-500" />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anotações do dia, destaques, dificuldades..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {existingLog ? 'Atualizar Registro' : 'Salvar Registro'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* HISTORY VIEW */}
      {viewMode === 'history' && (
        <div className="space-y-6">
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Ligações', value: totals.calls, color: 'text-blue-500' },
              { label: 'Reuniões', value: totals.meetings, color: 'text-purple-500' },
              { label: 'Propostas', value: totals.proposals, color: 'text-orange-500' },
              { label: 'Contratos', value: totals.contracts, color: 'text-green-500' },
              { label: 'Novos Leads', value: totals.leads, color: 'text-cyan-500' },
              { label: 'Follow-ups', value: totals.followUps, color: 'text-amber-500' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Evolução Diária</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Ligações" fill="hsl(217, 91%, 60%)" />
                    <Bar dataKey="Reuniões" fill="hsl(271, 91%, 65%)" />
                    <Bar dataKey="Propostas" fill="hsl(25, 95%, 53%)" />
                    <Bar dataKey="Contratos" fill="hsl(142, 71%, 45%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Ligações</TableHead>
                    <TableHead className="text-center">Reuniões</TableHead>
                    <TableHead className="text-center">Propostas</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Follow-ups</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum registro no período
                      </TableCell>
                    </TableRow>
                  ) : logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.log_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center">{log.calls_made}</TableCell>
                      <TableCell className="text-center">{log.meetings_held}</TableCell>
                      <TableCell className="text-center">{log.proposals_sent}</TableCell>
                      <TableCell className="text-center">{log.contracts_signed}</TableCell>
                      <TableCell className="text-center">{log.new_leads}</TableCell>
                      <TableCell className="text-center">{log.follow_ups}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TEAM VIEW (Admin only) */}
      {viewMode === 'team' && isAdmin && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da Equipe</CardTitle>
              <CardDescription>
                {periodFilter === 'week' ? 'Esta semana' : 'Este mês'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-center">Ligações</TableHead>
                    <TableHead className="text-center">Reuniões</TableHead>
                    <TableHead className="text-center">Propostas</TableHead>
                    <TableHead className="text-center">Contratos</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Follow-ups</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum registro no período
                      </TableCell>
                    </TableRow>
                  ) : teamSummary.map((member: any) => (
                    <TableRow key={member.name}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-center">{member.days}</TableCell>
                      <TableCell className="text-center">{member.calls}</TableCell>
                      <TableCell className="text-center">{member.meetings}</TableCell>
                      <TableCell className="text-center">{member.proposals}</TableCell>
                      <TableCell className="text-center font-semibold text-green-600">{member.contracts}</TableCell>
                      <TableCell className="text-center">{member.leads}</TableCell>
                      <TableCell className="text-center">{member.followUps}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
