import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Plus, Filter, CheckCircle2, Clock, AlertCircle, User, Flag, X, Edit, History, Calendar, List, Settings } from 'lucide-react';
import { TaskCalendarView } from '@/components/TaskCalendarView';
import { TaskNotificationSettings } from '@/components/TaskNotificationSettings';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { useUserRole } from '@/hooks/useUserRole';
import { TaskComments } from '@/components/TaskComments';
import { TaskAttachments } from '@/components/TaskAttachments';
import { useIsMobile } from '@/hooks/use-mobile';
import { TaskStatusHistory } from '@/components/TaskStatusHistory';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
  process_number?: string;
  category?: string;
  notes?: string;
}

const CACHE_KEY = 'advbox-tarefas-cache';
const CACHE_TIMESTAMP_KEY = 'advbox-tarefas-cache-timestamp';

const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (cached && timestamp) {
      const data = JSON.parse(cached);
      return {
        tasks: data,
        lastUpdate: new Date(timestamp)
      };
    }
  } catch (error) {
    console.error('Error loading tasks from cache:', error);
  }
  return null;
};

export default function TarefasAdvbox() {
  const cachedData = loadFromCache();
  const [tasks, setTasks] = useState<Task[]>(cachedData?.tasks || []);
  const [loading, setLoading] = useState(!cachedData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: '',
    status: 'pending',
    process_number: '',
    category: '',
    notes: '',
  });
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(cachedData?.lastUpdate);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<'alta' | 'media' | 'baixa'>('media');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewTab, setViewTab] = useState<string>('list');
  const { toast } = useToast();
  const { isAdmin, profile, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  
  // Hook para notificações push
  useTaskNotifications(tasks);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('approval_status', 'approved')
        .order('full_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTasks = async (forceRefresh = false) => {
    // Só mostrar loading se não tiver cache
    if (!cachedData) {
      setLoading(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      // A resposta vem como: { data: { data: { data: [...], offset, limit, totalCount } } }
      const apiResponse = data?.data || data;
      const rawTasksData = apiResponse?.data || [];

      // Se não recebeu dados válidos mas tinha cache, manter o cache
      if (rawTasksData.length === 0 && tasks.length > 0 && !forceRefresh) {
        console.log('No new data received, keeping cached tasks');
        setMetadata(data?.metadata);
        setLoading(false);
        return;
      }

      // Mapear campos da API para o formato esperado pelo frontend
      const tasksData = rawTasksData.map((apiTask: any) => {
        // Extrair responsáveis do array de users
        const assignedUsers = apiTask.users?.map((u: any) => u.name).filter(Boolean) || [];
        const assignedTo = assignedUsers.join(', ');
        
        // Usar date_deadline se disponível, senão date
        const dueDate = apiTask.date_deadline || apiTask.date || null;
        
        // Extrair número do processo
        const processNumber = apiTask.lawsuit?.process_number || null;
        
        // Determinar status baseado em se algum usuário completou
        const hasCompleted = apiTask.users?.some((u: any) => u.completed !== null);
        const status = hasCompleted ? 'completed' : 'pending';
        
        return {
          id: String(apiTask.id),
          title: apiTask.task || 'Sem título',
          description: apiTask.notes || '',
          due_date: dueDate,
          status: status,
          assigned_to: assignedTo,
          process_number: processNumber,
          category: '', // Será detectado automaticamente pelo calendário
        };
      });

      // Buscar prioridades do banco
      const { data: priorities } = await supabase
        .from('task_priorities')
        .select('task_id, priority');

      const tasksWithPriorities = tasksData.map((task: Task) => {
        const priorityData = priorities?.find((p) => p.task_id === task.id);
        return {
          ...task,
          priority: priorityData?.priority as 'alta' | 'media' | 'baixa' | undefined,
        };
      });
      
      if (tasksWithPriorities.length > 0) {
        setTasks(tasksWithPriorities);
        // Salvar no cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(tasksWithPriorities));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
      }
      
      setMetadata(data?.metadata);
      setLastUpdate(new Date());

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'As tarefas foram recarregadas.',
        });
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Manter dados em cache em caso de erro
      if (tasks.length === 0) {
        toast({
          title: 'Erro ao carregar tarefas',
          description: 'Não foi possível carregar as tarefas do Advbox.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Usando dados em cache',
          description: 'Não foi possível atualizar. Mostrando dados salvos anteriormente.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Por favor, informe o título da tarefa.',
        variant: 'destructive',
      });
      return;
    }

    if (!newTask.process_number.trim()) {
      toast({
        title: 'Número do processo obrigatório',
        description: 'Informe o número do processo para criar a tarefa no Advbox.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Buscar o processo correspondente no Advbox para obter os IDs necessários
      const { data: lawsuitsData, error: lawsuitsError } = await supabase.functions.invoke(
        'advbox-integration/lawsuits'
      );

      if (lawsuitsError) throw lawsuitsError;

      const lawsuits = (lawsuitsData as any)?.data || lawsuitsData || [];
      const processNumber = newTask.process_number.trim();

      const lawsuit = (lawsuits as any[]).find(
        (l: any) => l.process_number === processNumber
      );

      if (!lawsuit) {
        toast({
          title: 'Processo não encontrado',
          description: 'Não foi possível localizar o processo para criar a tarefa.',
          variant: 'destructive',
        });
        return;
      }

      const taskData = {
        lawsuits_id: lawsuit.id,
        start_date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        title: newTask.title,
        description:
          newTask.description ||
          newTask.notes ||
          `Tarefa criada pela intranet para o processo ${processNumber}`,
        from: lawsuit.responsible_id,
        tasks_id: 1,
        guests: [lawsuit.responsible_id],
        status: newTask.status,
        due_date: newTask.due_date || undefined,
      };

      const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: taskData,
      });

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });

      setDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        due_date: '',
        assigned_to: '',
        status: 'pending',
        process_number: '',
        category: '',
        notes: '',
      });
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description:
          error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const previousStatus = task?.status || 'unknown';

      const { error } = await supabase.functions.invoke('advbox-integration/complete-task', {
        body: { task_id: taskId },
      });

      if (error) throw error;

      // Registrar no histórico
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('task_status_history').insert({
          task_id: taskId,
          previous_status: previousStatus,
          new_status: 'completed',
          changed_by: user.id,
          notes: 'Tarefa marcada como concluída'
        });
      }

      toast({
        title: 'Tarefa concluída',
        description: 'A tarefa foi marcada como concluída.',
      });

      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Erro ao concluir tarefa',
        description: 'Não foi possível marcar a tarefa como concluída.',
        variant: 'destructive',
      });
    }
  };

  const handleEditTask = async () => {
    if (!editTask || !editTask.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Por favor, informe o título da tarefa.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const task = tasks.find(t => t.id === editTask.id);
      const previousStatus = task?.status;

      const { data, error } = await supabase.functions.invoke('advbox-integration/update-task', {
        body: {
          task_id: editTask.id,
          title: editTask.title,
          description: editTask.description,
          due_date: editTask.due_date,
          assigned_to: editTask.assigned_to,
          status: editTask.status,
        },
      });

      if (error) throw error;

      // Se o status mudou, registrar no histórico
      if (previousStatus && previousStatus !== editTask.status) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('task_status_history').insert({
            task_id: editTask.id,
            previous_status: previousStatus,
            new_status: editTask.status,
            changed_by: user.id,
            notes: 'Status alterado via edição'
          });
        }
      }

      toast({
        title: 'Tarefa atualizada',
        description: 'A tarefa foi atualizada com sucesso.',
      });

      setEditDialogOpen(false);
      setEditTask(null);
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro ao atualizar tarefa',
        description: 'Não foi possível atualizar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (task: Task) => {
    setEditTask({ ...task });
    setEditDialogOpen(true);
  };

  const handleSetPriority = async () => {
    if (!selectedTaskId) return;

    try {
      const { error } = await supabase
        .from('task_priorities')
        .upsert({
          task_id: selectedTaskId,
          priority: selectedPriority,
          set_by: (await supabase.auth.getUser()).data.user?.id,
        }, {
          onConflict: 'task_id'
        });

      if (error) throw error;

      toast({
        title: 'Prioridade definida',
        description: `Tarefa marcada como prioridade ${selectedPriority}.`,
      });

      setPriorityDialogOpen(false);
      fetchTasks();
    } catch (error) {
      console.error('Error setting priority:', error);
      toast({
        title: 'Erro ao definir prioridade',
        description: 'Não foi possível definir a prioridade da tarefa.',
        variant: 'destructive',
      });
    }
  };

  const openPriorityDialog = (taskId: string, currentPriority?: 'alta' | 'media' | 'baixa') => {
    setSelectedTaskId(taskId);
    setSelectedPriority(currentPriority || 'media');
    setPriorityDialogOpen(true);
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  // Tarefas visíveis de acordo com o papel do usuário
  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;

    // Usuários comuns só veem tarefas atribuídas a eles
    if (!profile?.full_name) return [];

    const currentName = profile.full_name.toLowerCase();

    return tasks.filter((task) =>
      task.assigned_to && task.assigned_to.toLowerCase().includes(currentName)
    );
  }, [tasks, isAdmin, profile?.full_name]);

  // Extrair lista única de responsáveis (usado apenas por admins)
  const assignedUsers = useMemo(() => {
    const users = new Set<string>();
    visibleTasks.forEach((task) => {
      if (task.assigned_to) {
        users.add(task.assigned_to);
      }
    });
    return Array.from(users).sort();
  }, [visibleTasks]);

  // Filtrar e ordenar tarefas
  const filteredTasks = useMemo(() => {
    let filtered = visibleTasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (assignedFilter !== 'all' && task.assigned_to !== assignedFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });

    // Ordenar por prioridade (alta > média > baixa > sem prioridade)
    const priorityOrder = { alta: 0, media: 1, baixa: 2 };
    filtered.sort((a, b) => {
      const aPriority = a.priority ? priorityOrder[a.priority] : 999;
      const bPriority = b.priority ? priorityOrder[b.priority] : 999;
      return aPriority - bPriority;
    });

    return filtered;
  }, [visibleTasks, statusFilter, assignedFilter, priorityFilter]);

  const getStatusIcon = (status?: string) => {
    const normalized = status?.toLowerCase() ?? '';
    switch (normalized) {
      case 'completed':
      case 'concluída':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'pending':
      case 'pendente':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
      case 'em andamento':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" => {
    const normalized = status?.toLowerCase() ?? '';
    switch (normalized) {
      case 'completed':
      case 'concluída':
        return 'default';
      case 'in_progress':
      case 'em andamento':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta':
        return 'bg-red-500 hover:bg-red-600';
      case 'media':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'baixa':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando tarefas...</div>
        </div>
      </Layout>
    );
  }

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando tarefas...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-primary" />
              Gestão de Tarefas
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas tarefas do Advbox
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fetchTasks(true)}
            >
              <Flag className="h-4 w-4 mr-2" />
              Atualizar dados
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Tarefa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Criar Nova Tarefa</DialogTitle>
                  <DialogDescription>
                    Preencha os campos abaixo para criar uma nova tarefa no Advbox
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Título da tarefa"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Descrição da tarefa"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="process_number">Número do Processo</Label>
                  <Input
                    id="process_number"
                    value={newTask.process_number}
                    onChange={(e) => setNewTask({ ...newTask, process_number: e.target.value })}
                    placeholder="Ex: 1234567-89.2023.8.26.0100"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={newTask.category}
                    onValueChange={(value) => setNewTask({ ...newTask, category: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="intimacao">Intimação</SelectItem>
                      <SelectItem value="audiencia">Audiência</SelectItem>
                      <SelectItem value="prazo">Prazo</SelectItem>
                      <SelectItem value="recurso">Recurso</SelectItem>
                      <SelectItem value="sentenca">Sentença</SelectItem>
                      <SelectItem value="despacho">Despacho</SelectItem>
                      <SelectItem value="peticao">Petição</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigned_to">Responsável</Label>
                  <Select
                    value={newTask.assigned_to}
                    onValueChange={(value) =>
                      setNewTask({ ...newTask, assigned_to: value === 'none' ? '' : value })
                    }
                  >
                    <SelectTrigger id="assigned_to">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.full_name}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="due_date">Data de Vencimento</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newTask.status}
                    onValueChange={(value) => setNewTask({ ...newTask, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={newTask.notes}
                    onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                    placeholder="Observações adicionais"
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreateTask} className="w-full">
                  Criar Tarefa
                </Button>
              </div>
              </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Tabs de Visualização */}
        <Tabs value={viewTab} onValueChange={setViewTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
          </TabsList>

          {/* Aba Lista */}
          <TabsContent value="list" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority-filter">Prioridade</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger id="priority-filter">
                        <SelectValue placeholder="Filtrar por prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as prioridades</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin && (
                    <div>
                      <Label htmlFor="assigned-filter">Responsável</Label>
                      <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                        <SelectTrigger id="assigned-filter">
                          <SelectValue placeholder="Filtrar por responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os responsáveis</SelectItem>
                          {assignedUsers.map((user) => (
                            <SelectItem key={user} value={user}>
                              {user}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de Tarefas */}
            <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? 'Todas as Tarefas' : 'Suas Tarefas'}</CardTitle>
            <CardDescription>
              {filteredTasks.length} de {visibleTasks.length}{' '}
              {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma tarefa encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => openTaskDetails(task)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{task.title}</h3>
                              {task.priority && (
                                <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>
                                  {task.priority.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getStatusVariant(task.status)}
                              className="flex items-center gap-1"
                            >
                              {getStatusIcon(task.status)}
                              {task.status}
                            </Badge>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(task);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.due_date), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })}
                            </span>
                          )}
                          {task.assigned_to && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assigned_to}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Aba Calendário */}
          <TabsContent value="calendar">
            <TaskCalendarView 
              tasks={filteredTasks} 
              onTaskClick={openTaskDetails}
            />
          </TabsContent>

          {/* Aba Configurações de Notificação */}
          <TabsContent value="settings">
            <TaskNotificationSettings />
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição de Tarefa (Admin) */}
        {isAdmin && editTask && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Editar Tarefa</DialogTitle>
                <DialogDescription>Atualize os campos da tarefa</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Título *</Label>
                  <Input
                    id="edit-title"
                    value={editTask.title}
                    onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                    placeholder="Título da tarefa"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editTask.description || ''}
                    onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                    placeholder="Descrição da tarefa"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-process_number">Número do Processo</Label>
                  <Input
                    id="edit-process_number"
                    value={editTask.process_number || ''}
                    onChange={(e) => setEditTask({ ...editTask, process_number: e.target.value })}
                    placeholder="Ex: 1234567-89.2023.8.26.0100"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Select
                    value={editTask.category || 'none'}
                    onValueChange={(value) =>
                      setEditTask({ ...editTask, category: value === 'none' ? '' : value })
                    }
                  >
                    <SelectTrigger id="edit-category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="intimacao">Intimação</SelectItem>
                      <SelectItem value="audiencia">Audiência</SelectItem>
                      <SelectItem value="prazo">Prazo</SelectItem>
                      <SelectItem value="recurso">Recurso</SelectItem>
                      <SelectItem value="sentenca">Sentença</SelectItem>
                      <SelectItem value="despacho">Despacho</SelectItem>
                      <SelectItem value="peticao">Petição</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-assigned_to">Responsável</Label>
                  <Select
                    value={editTask.assigned_to || 'none'}
                    onValueChange={(value) =>
                      setEditTask({
                        ...editTask,
                        assigned_to: value === 'none' ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger id="edit-assigned_to">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.full_name}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-due_date">Data de Vencimento</Label>
                  <Input
                    id="edit-due_date"
                    type="date"
                    value={editTask.due_date || ''}
                    onChange={(e) => setEditTask({ ...editTask, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editTask.status}
                    onValueChange={(value) => setEditTask({ ...editTask, status: value })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-notes">Observações</Label>
                  <Textarea
                    id="edit-notes"
                    value={editTask.notes || ''}
                    onChange={(e) => setEditTask({ ...editTask, notes: e.target.value })}
                    placeholder="Observações adicionais"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEditTask} className="flex-1">
                    Salvar Alterações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog de Prioridade */}
        <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir Prioridade</DialogTitle>
              <DialogDescription>Escolha a prioridade para esta tarefa</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={selectedPriority}
                  onValueChange={(value: 'alta' | 'media' | 'baixa') => setSelectedPriority(value)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        Alta
                      </div>
                    </SelectItem>
                    <SelectItem value="media">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        Média
                      </div>
                    </SelectItem>
                    <SelectItem value="baixa">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        Baixa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSetPriority} className="w-full">
                Salvar Prioridade
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detalhes da Tarefa com Comentários, Anexos e Histórico */}
        {isMobile ? (
          <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  {selectedTask?.title}
                  {selectedTask?.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-white border-0`}>
                      {selectedTask.priority.toUpperCase()}
                    </Badge>
                  )}
                </DrawerTitle>
                <DrawerDescription>{selectedTask?.description}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                    {selectedTask && <TaskStatusHistory taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>
              </div>
              <DrawerFooter>
                <div className="flex gap-2">
                  {selectedTask &&
                    selectedTask.status !== 'completed' &&
                    selectedTask.status !== 'concluída' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDetailsOpen(false);
                            openPriorityDialog(selectedTask.id, selectedTask.priority);
                          }}
                          className="flex-1"
                        >
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Prioridade
                        </Button>
                        <Button
                          onClick={() => {
                            handleCompleteTask(selectedTask.id);
                            setDetailsOpen(false);
                          }}
                          className="flex-1"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Concluir
                        </Button>
                      </>
                    )}
                </div>
                <DrawerClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTask?.title}
                  {selectedTask?.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-white border-0`}>
                      {selectedTask.priority.toUpperCase()}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedTask?.description}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4">
                {selectedTask && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-4 border-b">
                    <Badge
                      variant={getStatusVariant(selectedTask.status)}
                      className="flex items-center gap-1"
                    >
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.status}
                    </Badge>
                    {selectedTask.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(selectedTask.due_date), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                    {selectedTask.assigned_to && (
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {selectedTask.assigned_to}
                      </span>
                    )}
                  </div>
                )}

                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                    {selectedTask && <TaskStatusHistory taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>

                {selectedTask &&
                  selectedTask.status !== 'completed' &&
                  selectedTask.status !== 'concluída' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDetailsOpen(false);
                          openPriorityDialog(selectedTask.id, selectedTask.priority);
                        }}
                        className="flex-1"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {selectedTask.priority
                          ? 'Alterar Prioridade'
                          : 'Definir Prioridade'}
                      </Button>
                      <Button
                        onClick={() => {
                          handleCompleteTask(selectedTask.id);
                          setDetailsOpen(false);
                        }}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar como Concluída
                      </Button>
                    </div>
                  )}
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}

