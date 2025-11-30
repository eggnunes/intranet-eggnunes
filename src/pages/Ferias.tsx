import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
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
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, Plus, User } from 'lucide-react';
import { format, differenceInBusinessDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
}

export default function Ferias() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
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

  useEffect(() => {
    if (user) {
      fetchData();
      if (isAdmin) {
        fetchProfiles();
      }
    }
  }, [user, isAdmin, selectedUser]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
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
        profiles:user_id (full_name, avatar_url),
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

  const calculateBusinessDays = (start: Date, end: Date): number => {
    return differenceInBusinessDays(end, start) + 1;
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

    const businessDays = calculateBusinessDays(startDate, endDate);
    const currentYear = new Date().getFullYear();
    const availableDays = balance?.available_days ?? 20;

    if (businessDays > availableDays) {
      toast({
        title: 'Saldo insuficiente',
        description: `Você tem apenas ${availableDays} dias disponíveis`,
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
        business_days: businessDays,
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

    const businessDays = calculateBusinessDays(startDate, endDate);

    const { error } = await supabase
      .from('vacation_requests')
      .insert({
        user_id: adminSelectedUser,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        business_days: businessDays,
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

  const currentYear = new Date().getFullYear();
  const displayBalance = balance || { total_days: 20, used_days: 0, available_days: 20 };

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
                        Dias úteis: {calculateBusinessDays(startDate, endDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Saldo disponível: {displayBalance.available_days} dias
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

            {isAdmin && (
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
                              {profile.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                          Dias úteis: {calculateBusinessDays(startDate, endDate)}
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

        {isAdmin && (
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
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Saldo de Férias {currentYear}</CardTitle>
            <CardDescription>Acompanhe seus dias de férias disponíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{displayBalance.total_days} dias</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Utilizados</p>
                <p className="text-2xl font-bold text-orange-600">{displayBalance.used_days} dias</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Disponíveis</p>
                <p className="text-2xl font-bold text-green-600">{displayBalance.available_days} dias</p>
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
                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{request.profiles.full_name}</span>
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
                                  ({request.business_days} dias úteis)
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
                              {isAdmin && request.status === 'pending' && (
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
