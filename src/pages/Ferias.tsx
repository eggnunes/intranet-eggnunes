import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Plus, User, Info } from 'lucide-react';
import { format, differenceInBusinessDays, differenceInCalendarDays, parseISO, addYears, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface VacationBalance {
  id: string;
  user_id: string;
  year: number;
  total_days: number;
  used_days: number;
  available_days: number;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  join_date: string | null;
}

interface UserProfile {
  position: string | null;
  join_date: string | null;
}

// Check if position is CLT (administrativo = 30 consecutive days)
const isCLT = (position: string | null): boolean => {
  return position === 'administrativo';
};

// Get total vacation days based on position
const getTotalVacationDays = (position: string | null): number => {
  return isCLT(position) ? 30 : 20;
};

// Get vacation type label
const getVacationTypeLabel = (position: string | null): string => {
  return isCLT(position) ? 'dias corridos' : 'dias úteis';
};

// Calculate vacation period based on join_date
const calculateVacationPeriod = (joinDate: string | null): { startDate: Date; endDate: Date; periodLabel: string } | null => {
  if (!joinDate) return null;
  
  const join = parseISO(joinDate);
  const today = new Date();
  
  // Find the current vacation period based on join_date anniversary
  let periodStart = join;
  let periodEnd = addYears(join, 1);
  
  // Move forward until we find the period that contains today or the most recent completed period
  while (isBefore(periodEnd, today)) {
    periodStart = periodEnd;
    periodEnd = addYears(periodStart, 1);
  }
  
  // If today is before the first anniversary, use that first year
  if (isAfter(join, today)) {
    periodStart = join;
    periodEnd = addYears(join, 1);
  }
  
  const periodLabel = `${format(periodStart, "dd/MM/yyyy")} - ${format(periodEnd, "dd/MM/yyyy")}`;
  
  return { startDate: periodStart, endDate: periodEnd, periodLabel };
};

export default function Ferias() {
  const { user } = useAuth();
  const { isAdmin, profile: userProfile } = useUserRole();
  const { canEdit, isSocioOrRafael } = useAdminPermissions();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  
  // Check if user can manage vacations
  const canManageVacations = isAdmin && (isSocioOrRafael || canEdit('vacation'));

  useEffect(() => {
    if (user) {
      fetchData();
      fetchCurrentUserProfile();
      if (canManageVacations) {
        fetchProfiles();
      }
    }
  }, [user, canManageVacations, selectedUser]);

  // Update selected user profile when admin selects a user
  useEffect(() => {
    if (adminSelectedUser) {
      const profile = profiles.find(p => p.id === adminSelectedUser);
      if (profile) {
        setSelectedUserProfile({
          position: profile.position,
          join_date: profile.join_date
        });
      }
    } else {
      setSelectedUserProfile(null);
    }
  }, [adminSelectedUser, profiles]);

  const fetchCurrentUserProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('position, join_date')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, position, join_date')
      .eq('approval_status', 'approved')
      .order('full_name');
    
    if (data) {
      setProfiles(data);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Buscar solicitações
    let requestsQuery = supabase
      .from('vacation_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url, position),
        approver:approved_by (full_name)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      requestsQuery = requestsQuery.eq('user_id', user!.id);
    } else if (selectedUser !== 'all') {
      requestsQuery = requestsQuery.eq('user_id', selectedUser);
    }

    const { data: requestsData } = await requestsQuery;
    if (requestsData) {
      setRequests(requestsData as any);
    }

    // Buscar saldo do ano atual
    const currentYear = new Date().getFullYear();
    const userId = isAdmin && selectedUser !== 'all' ? selectedUser : user!.id;
    
    const { data: balanceData } = await supabase
      .from('vacation_balance')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .single();

    setBalance(balanceData);
    setLoading(false);
  };

  // Calculate days based on position (CLT = consecutive, others = business days)
  const calculateDays = (start: Date, end: Date, position: string | null): number => {
    if (isCLT(position)) {
      // CLT: consecutive calendar days (including start and end)
      return differenceInCalendarDays(end, start) + 1;
    } else {
      // Non-CLT: business days only
      return differenceInBusinessDays(end, start) + 1;
    }
  };

  // Get profile for calculation context
  const getActiveProfile = (): UserProfile | null => {
    if (isAdminCreateOpen && selectedUserProfile) {
      return selectedUserProfile;
    }
    return currentUserProfile;
  };

  // Calculate vacation balance based on join_date and used days
  const calculateVacationBalance = (profile: UserProfile | null, usedDays: number): { total: number; used: number; available: number } => {
    const totalDays = getTotalVacationDays(profile?.position || null);
    const available = Math.max(0, totalDays - usedDays);
    return { total: totalDays, used: usedDays, available };
  };

  const handleCreateRequest = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Erro',
        description: 'Selecione as datas de início e fim',
        variant: 'destructive',
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: 'Erro',
        description: 'Data de início não pode ser posterior à data de fim',
        variant: 'destructive',
      });
      return;
    }

    const days = calculateDays(startDate, endDate, currentUserProfile?.position || null);
    const totalDays = getTotalVacationDays(currentUserProfile?.position || null);
    const usedDays = balance?.used_days ?? 0;
    const availableDays = totalDays - usedDays;

    if (days > availableDays) {
      toast({
        title: 'Saldo insuficiente',
        description: `Você tem apenas ${availableDays} ${getVacationTypeLabel(currentUserProfile?.position || null)} disponíveis`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: user!.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        business_days: days,
        notes,
      });

    if (error) {
      toast({
        title: 'Erro ao criar solicitação',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação criada',
      description: 'Sua solicitação de férias foi enviada para aprovação',
    });

    setIsNewRequestOpen(false);
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    fetchData();
  };

  const handleAdminCreate = async () => {
    if (!adminSelectedUser || !startDate || !endDate) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const days = calculateDays(startDate, endDate, selectedUserProfile?.position || null);

    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: adminSelectedUser,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        business_days: days,
        status: 'approved',
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
        notes,
      });

    if (error) {
      toast({
        title: 'Erro ao registrar férias',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Férias registradas',
      description: 'Período de férias cadastrado com sucesso',
    });

    setIsAdminCreateOpen(false);
    setAdminSelectedUser('');
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    fetchData();
  };

  const handleApprove = async (requestId: string) => {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'approved',
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação aprovada',
      description: 'As férias foram aprovadas com sucesso',
    });
    fetchData();
  };

  const handleReject = async (requestId: string, reason: string) => {
    const { error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        approved_by: user!.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Solicitação rejeitada',
      description: 'A solicitação foi rejeitada',
    });
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'outline' as const, label: 'Pendente', icon: Clock },
      approved: { variant: 'default' as const, label: 'Aprovada', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejeitada', icon: XCircle },
    };
    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Calculate display balance
  const totalDays = getTotalVacationDays(currentUserProfile?.position || null);
  const usedDays = balance?.used_days ?? 0;
  const availableDays = totalDays - usedDays;
  const vacationTypeLabel = getVacationTypeLabel(currentUserProfile?.position || null);
  const vacationPeriod = calculateVacationPeriod(currentUserProfile?.join_date || null);

  // For dialogs - calculate days preview
  const activeProfile = getActiveProfile();
  const previewDays = startDate && endDate ? calculateDays(startDate, endDate, activeProfile?.position || null) : 0;
  const previewTypeLabel = getVacationTypeLabel(activeProfile?.position || null);

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Férias</h1>
            <p className="text-muted-foreground">Gerencie suas férias e acompanhe seu saldo</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Solicitação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação de Férias</DialogTitle>
                  <DialogDescription>
                    Solicite suas férias informando o período desejado
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {isCLT(currentUserProfile?.position || null) ? (
                        <>Você é colaborador CLT e tem direito a <strong>30 dias corridos</strong> de férias por ano.</>
                      ) : (
                        <>Você tem direito a <strong>20 dias úteis</strong> de férias por ano.</>
                      )}
                    </AlertDescription>
                  </Alert>
                  <div>
                    <Label>Data de Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Data de Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {startDate && endDate && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">
                        {previewTypeLabel === 'dias corridos' ? 'Dias corridos' : 'Dias úteis'}: {previewDays}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Saldo disponível: {availableDays} {vacationTypeLabel}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione observações sobre sua solicitação"
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleCreateRequest} className="w-full">
                    Enviar Solicitação
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {canManageVacations && (
              <Dialog open={isAdminCreateOpen} onOpenChange={setIsAdminCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Cadastrar Férias Passadas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Período de Férias</DialogTitle>
                    <DialogDescription>
                      Registre períodos de férias já tirados
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Colaborador</Label>
                      <Select value={adminSelectedUser} onValueChange={setAdminSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o colaborador" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name} {profile.position === 'administrativo' && '(CLT)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedUserProfile && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {isCLT(selectedUserProfile.position) ? (
                            <>Este colaborador é <strong>CLT</strong> e tem direito a <strong>30 dias corridos</strong> de férias por ano.</>
                          ) : (
                            <>Este colaborador tem direito a <strong>20 dias úteis</strong> de férias por ano.</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label>Data de Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Data de Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {startDate && endDate && selectedUserProfile && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium">
                          {isCLT(selectedUserProfile.position) ? 'Dias corridos' : 'Dias úteis'}: {previewDays}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Adicione observações"
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAdminCreate} className="w-full">
                      Cadastrar Férias
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {canManageVacations && (
          <Card>
            <CardHeader>
              <CardTitle>Filtrar por Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name} {profile.position === 'administrativo' && '(CLT)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Saldo de Férias
              {vacationPeriod && (
                <Badge variant="outline" className="font-normal">
                  Período: {vacationPeriod.periodLabel}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isCLT(currentUserProfile?.position || null) ? (
                <>Colaborador CLT - 30 dias corridos por ano</>
              ) : (
                <>Colaborador - 20 dias úteis por ano</>
              )}
              {currentUserProfile?.join_date && (
                <> (ingresso em {format(parseISO(currentUserProfile.join_date), "dd/MM/yyyy")})</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalDays} {vacationTypeLabel}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Utilizados</p>
                <p className="text-2xl font-bold text-orange-600">{usedDays} {vacationTypeLabel}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Disponíveis</p>
                <p className="text-2xl font-bold text-green-600">{availableDays} {vacationTypeLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="approved">Aprovadas</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
              </TabsList>
              
              {['all', 'pending', 'approved', 'rejected'].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {requests
                    .filter((req) => tab === 'all' || req.status === tab)
                    .map((request) => (
                      <Card key={request.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              {canManageVacations && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{request.profiles.full_name}</span>
                                  {request.profiles.position === 'administrativo' && (
                                    <Badge variant="secondary" className="text-xs">CLT</Badge>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  {format(parseISO(request.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                                <span>→</span>
                                <span>
                                  {format(parseISO(request.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </span>
                                <span className="text-muted-foreground">
                                  ({request.business_days} {request.profiles.position === 'administrativo' ? 'dias corridos' : 'dias úteis'})
                                </span>
                              </div>
                              {request.notes && (
                                <p className="text-sm text-muted-foreground mt-2">{request.notes}</p>
                              )}
                              {request.rejection_reason && (
                                <p className="text-sm text-destructive mt-2">
                                  Motivo: {request.rejection_reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(request.status)}
                              {canManageVacations && request.status === 'pending' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(request.id)}
                                  >
                                    Aprovar
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline">
                                        Rejeitar
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Rejeitar Solicitação</DialogTitle>
                                        <DialogDescription>
                                          Informe o motivo da rejeição
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <Textarea
                                          id={`reason-${request.id}`}
                                          placeholder="Motivo da rejeição"
                                          rows={3}
                                        />
                                        <Button
                                          onClick={() => {
                                            const reason = (document.getElementById(`reason-${request.id}`) as HTMLTextAreaElement)?.value;
                                            if (reason) {
                                              handleReject(request.id, reason);
                                            }
                                          }}
                                          className="w-full"
                                        >
                                          Confirmar Rejeição
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {requests.filter((req) => tab === 'all' || req.status === tab).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma solicitação encontrada
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
