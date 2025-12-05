import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Clock, CheckCircle, TrendingUp, CalendarDays, AlertCircle, Trash2, Pencil } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, addMonths, isBefore, isAfter, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from '@/hooks/use-toast';

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    position: string | null;
  };
  approver?: {
    full_name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  join_date: string | null;
}

interface VacationDashboardProps {
  onEditRequest?: (request: VacationRequest) => void;
  onDeleteRequest?: (requestId: string) => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function VacationDashboard({ onEditRequest, onDeleteRequest }: VacationDashboardProps) {
  const [allRequests, setAllRequests] = useState<VacationRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [requestsRes, profilesRes] = await Promise.all([
      supabase
        .from('vacation_requests')
        .select(`
          *,
          profiles:user_id (full_name, avatar_url, position),
          approver:approved_by (full_name)
        `)
        .order('start_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position, join_date')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .order('full_name')
    ]);

    if (requestsRes.data) setAllRequests(requestsRes.data as any);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  };

  const isCLT = (position: string | null) => position === 'administrativo';

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'outline' as const, label: 'Pendente' },
      approved: { variant: 'default' as const, label: 'Aprovada' },
      rejected: { variant: 'destructive' as const, label: 'Rejeitada' },
    };
    const config = variants[status as keyof typeof variants];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Filter requests by selected year
  const yearRequests = useMemo(() => {
    return allRequests.filter(req => {
      const year = new Date(req.start_date).getFullYear();
      return year.toString() === selectedYear;
    });
  }, [allRequests, selectedYear]);

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date();
    const approvedRequests = yearRequests.filter(r => r.status === 'approved');
    const pendingRequests = yearRequests.filter(r => r.status === 'pending');
    
    const currentlyOnVacation = approvedRequests.filter(r => {
      const start = parseISO(r.start_date);
      const end = parseISO(r.end_date);
      return isWithinInterval(today, { start, end });
    });

    const upcomingVacations = approvedRequests.filter(r => {
      const start = parseISO(r.start_date);
      return isAfter(start, today) && differenceInDays(start, today) <= 30;
    });

    const totalDaysUsed = approvedRequests.reduce((sum, r) => sum + r.business_days, 0);

    return {
      totalRequests: yearRequests.length,
      approvedRequests: approvedRequests.length,
      pendingRequests: pendingRequests.length,
      currentlyOnVacation: currentlyOnVacation.length,
      upcomingVacations: upcomingVacations.length,
      totalDaysUsed,
      currentVacationers: currentlyOnVacation,
      upcomingList: upcomingVacations.slice(0, 5)
    };
  }, [yearRequests]);

  // Monthly distribution chart data
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(parseInt(selectedYear), i, 1), 'MMM', { locale: ptBR }),
      aprovadas: 0,
      pendentes: 0,
      diasUsados: 0
    }));

    yearRequests.forEach(req => {
      const monthIndex = new Date(req.start_date).getMonth();
      if (req.status === 'approved') {
        months[monthIndex].aprovadas++;
        months[monthIndex].diasUsados += req.business_days;
      } else if (req.status === 'pending') {
        months[monthIndex].pendentes++;
      }
    });

    return months;
  }, [yearRequests, selectedYear]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const approved = yearRequests.filter(r => r.status === 'approved').length;
    const pending = yearRequests.filter(r => r.status === 'pending').length;
    const rejected = yearRequests.filter(r => r.status === 'rejected').length;
    
    return [
      { name: 'Aprovadas', value: approved },
      { name: 'Pendentes', value: pending },
      { name: 'Rejeitadas', value: rejected }
    ].filter(d => d.value > 0);
  }, [yearRequests]);

  // Balance by employee
  const employeeBalances = useMemo(() => {
    return profiles.map(profile => {
      const userRequests = yearRequests.filter(r => r.user_id === profile.id && r.status === 'approved');
      const usedDays = userRequests.reduce((sum, r) => sum + r.business_days, 0);
      const totalDays = isCLT(profile.position) ? 30 : 20;
      const availableDays = totalDays - usedDays;
      
      return {
        ...profile,
        totalDays,
        usedDays,
        availableDays,
        vacationType: isCLT(profile.position) ? 'CLT (dias corridos)' : 'Padrão (dias úteis)'
      };
    }).sort((a, b) => b.usedDays - a.usedDays);
  }, [profiles, yearRequests]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard de Férias</h2>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{kpis.totalRequests}</p>
                <p className="text-xs text-muted-foreground">Total de Solicitações</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{kpis.approvedRequests}</p>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-600">{kpis.pendingRequests}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{kpis.currentlyOnVacation}</p>
                <p className="text-xs text-muted-foreground">Em Férias Agora</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{kpis.upcomingVacations}</p>
                <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-600">{kpis.totalDaysUsed}</p>
                <p className="text-xs text-muted-foreground">Dias Utilizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição Mensal</CardTitle>
            <CardDescription>Férias por mês em {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="aprovadas" name="Aprovadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status das Solicitações</CardTitle>
            <CardDescription>Distribuição por status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current/Upcoming Vacations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Currently on Vacation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Em Férias Agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.currentVacationers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum colaborador em férias no momento</p>
            ) : (
              <div className="space-y-3">
                {kpis.currentVacationers.map(req => (
                  <div key={req.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.profiles.avatar_url || ''} />
                      <AvatarFallback>
                        {req.profiles.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{req.profiles.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')}
                      </p>
                    </div>
                    <Badge variant="secondary">{req.business_days} dias</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Vacations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Próximas Férias (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.upcomingList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma férias agendada nos próximos 30 dias</p>
            ) : (
              <div className="space-y-3">
                {kpis.upcomingList.map(req => (
                  <div key={req.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.profiles.avatar_url || ''} />
                      <AvatarFallback>
                        {req.profiles.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{req.profiles.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Início: {format(parseISO(req.start_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline">{req.business_days} dias</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Saldo de Férias por Colaborador</CardTitle>
          <CardDescription>Visualize o saldo de cada membro da equipe em {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Utilizados</TableHead>
                  <TableHead className="text-center">Disponíveis</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeBalances.map(emp => {
                  const percentage = Math.round((emp.usedDays / emp.totalDays) * 100);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.avatar_url || ''} />
                            <AvatarFallback>
                              {emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{emp.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isCLT(emp.position) ? 'secondary' : 'outline'} className="text-xs">
                          {emp.vacationType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{emp.totalDays}</TableCell>
                      <TableCell className="text-center text-orange-600 font-medium">{emp.usedDays}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{emp.availableDays}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all" 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* All Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Solicitações de {selectedYear}</CardTitle>
          <CardDescription>Lista completa de férias cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  {(onEditRequest || onDeleteRequest) && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={request.profiles.avatar_url || ''} />
                          <AvatarFallback>
                            {request.profiles.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{request.profiles.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.start_date), 'dd/MM/yyyy')} - {format(parseISO(request.end_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {request.business_days} {isCLT(request.profiles.position) ? 'dias corridos' : 'dias úteis'}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <Badge variant={isCLT(request.profiles.position) ? 'secondary' : 'outline'}>
                        {isCLT(request.profiles.position) ? 'CLT' : 'Padrão'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(parseISO(request.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    {(onEditRequest || onDeleteRequest) && (
                      <TableCell>
                        <div className="flex gap-1">
                          {onEditRequest && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditRequest(request)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {onDeleteRequest && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onDeleteRequest(request.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}