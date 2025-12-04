import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Package, Wrench, Monitor, AlertCircle, Clock, CheckCircle, XCircle, Loader2, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdministrativeRequest {
  id: string;
  user_id: string;
  request_type: 'material' | 'maintenance' | 'it' | 'other';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  handled_by: string | null;
  handled_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  handler?: {
    full_name: string;
  };
}

export default function SolicitacoesAdministrativas() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canView, loading: permLoading } = useAdminPermissions();
  const [requests, setRequests] = useState<AdministrativeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');

  const hasAdminRequestsAccess = canView('admin_requests');

  useEffect(() => {
    if (user) {
      fetchRequests();
      setupRealtimeSubscription();
    }
  }, [user, isAdmin]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('administrative_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'administrative_requests',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchRequests = async () => {
    setLoading(true);
    
    let query = supabase
      .from('administrative_requests')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url),
        handler:handled_by (full_name)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user!.id);
    }

    const { data } = await query;
    if (data) {
      setRequests(data as any);
    }
    
    setLoading(false);
  };

  const handleCreateRequest = async () => {
    if (!requestType || !title || !description) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('administrative_requests')
      .insert({
        user_id: user!.id,
        request_type: requestType,
        title,
        description,
        priority,
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
      description: 'Sua solicitação foi enviada com sucesso',
    });

    setIsNewRequestOpen(false);
    setRequestType('');
    setTitle('');
    setDescription('');
    setPriority('medium');
    fetchRequests();
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string, resolutionNotes?: string) => {
    const updateData: any = {
      status: newStatus,
      handled_by: user!.id,
      handled_at: new Date().toISOString(),
    };

    if (resolutionNotes) {
      updateData.resolution_notes = resolutionNotes;
    }

    const { error } = await supabase
      .from('administrative_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Status atualizado',
      description: 'A solicitação foi atualizada com sucesso',
    });
    fetchRequests();
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      material: Package,
      maintenance: Wrench,
      it: Monitor,
      other: AlertCircle,
    };
    return icons[type as keyof typeof icons] || AlertCircle;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      material: 'Material de Escritório',
      maintenance: 'Manutenção',
      it: 'TI',
      other: 'Outro',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'outline' as const, label: 'Pendente', icon: Clock, className: 'border-yellow-500 text-yellow-700' },
      in_progress: { variant: 'secondary' as const, label: 'Em Andamento', icon: Loader2, className: 'bg-blue-100 text-blue-700' },
      completed: { variant: 'default' as const, label: 'Concluída', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
      rejected: { variant: 'destructive' as const, label: 'Rejeitada', icon: XCircle, className: '' },
    };
    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: { label: 'Baixa', className: 'bg-gray-100 text-gray-700' },
      medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-700' },
      high: { label: 'Alta', className: 'bg-red-100 text-red-700' },
    };
    const config = variants[priority as keyof typeof variants];
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (roleLoading || permLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (!hasAdminRequestsAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Lock className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar as solicitações administrativas.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Solicitações Administrativas</h1>
            <p className="text-muted-foreground">Gerencie pedidos de material, manutenção e TI</p>
          </div>
          <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Solicitação</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes da sua solicitação
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Solicitação</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material de Escritório</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                      <SelectItem value="it">TI</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Necessidade de canetas"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva em detalhes o que você precisa"
                    rows={4}
                  />
                </div>
                <Button onClick={handleCreateRequest} className="w-full">
                  Criar Solicitação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Minhas Solicitações</CardTitle>
            <CardDescription>Acompanhe o status das suas solicitações</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
                <TabsTrigger value="completed">Concluídas</TabsTrigger>
              </TabsList>
              
              {['all', 'pending', 'in_progress', 'completed'].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
                  {requests
                    .filter((req) => tab === 'all' || req.status === tab)
                    .map((request) => {
                      const TypeIcon = getTypeIcon(request.request_type);
                      return (
                        <Card key={request.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                  <TypeIcon className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {getTypeLabel(request.request_type)}
                                  </span>
                                  {getPriorityBadge(request.priority)}
                                </div>
                                {isAdmin && (
                                  <div className="text-sm text-muted-foreground">
                                    Solicitado por: {request.profiles.full_name}
                                  </div>
                                )}
                                <h3 className="font-semibold text-lg">{request.title}</h3>
                                <p className="text-sm text-muted-foreground">{request.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  Criada em {format(parseISO(request.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {request.resolution_notes && (
                                  <div className="mt-2 p-3 bg-muted rounded-md">
                                    <p className="text-sm font-medium">Resolução:</p>
                                    <p className="text-sm text-muted-foreground">{request.resolution_notes}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {getStatusBadge(request.status)}
                                {isAdmin && request.status !== 'completed' && request.status !== 'rejected' && (
                                  <div className="flex flex-col gap-2 mt-2">
                                    {request.status === 'pending' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUpdateStatus(request.id, 'in_progress')}
                                      >
                                        Iniciar
                                      </Button>
                                    )}
                                    {request.status === 'in_progress' && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button size="sm">
                                            Concluir
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Concluir Solicitação</DialogTitle>
                                            <DialogDescription>
                                              Adicione notas sobre a resolução (opcional)
                                            </DialogDescription>
                                          </DialogHeader>
                                          <div className="space-y-4">
                                            <Textarea
                                              id={`resolution-${request.id}`}
                                              placeholder="Descreva como a solicitação foi resolvida"
                                              rows={3}
                                            />
                                            <Button
                                              onClick={() => {
                                                const notes = (document.getElementById(`resolution-${request.id}`) as HTMLTextAreaElement)?.value;
                                                handleUpdateStatus(request.id, 'completed', notes);
                                              }}
                                              className="w-full"
                                            >
                                              Marcar como Concluída
                                            </Button>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleUpdateStatus(request.id, 'rejected')}
                                    >
                                      Rejeitar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
