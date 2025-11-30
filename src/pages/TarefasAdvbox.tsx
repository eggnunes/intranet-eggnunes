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
import { CheckSquare, Plus, Filter, CheckCircle2, Clock, AlertCircle, User, Flag, X } from 'lucide-react';
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

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
}

export default function TarefasAdvbox() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
  });
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<'alta' | 'media' | 'baixa'>('media');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      // Garantir que tasks seja sempre um array
      let tasksData = [];
      if (data?.data && Array.isArray(data.data)) {
        tasksData = data.data;
      } else if (Array.isArray(data)) {
        tasksData = data;
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Se data for um objeto, tentar extrair array de possíveis propriedades
        tasksData = data.tasks || data.items || [];
      }

      // Buscar prioridades do banco
      const { data: priorities } = await supabase
        .from('task_priorities')
        .select('task_id, priority');

      // Mesclar prioridades com tarefas
      const tasksWithPriorities = tasksData.map((task: Task) => {
        const priorityData = priorities?.find((p) => p.task_id === task.id);
        return {
          ...task,
          priority: priorityData?.priority as 'alta' | 'media' | 'baixa' | undefined,
        };
      });
      
      setTasks(Array.isArray(tasksWithPriorities) ? tasksWithPriorities : []);
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
      setTasks([]); // Garantir que tasks seja array mesmo em caso de erro
      toast({
        title: 'Erro ao carregar tarefas',
        description: 'Não foi possível carregar as tarefas do Advbox.',
        variant: 'destructive',
      });
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

    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: newTask,
      });

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });

      setDialogOpen(false);
      setNewTask({ title: '', description: '', due_date: '' });
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.functions.invoke('advbox-integration/complete-task', {
        body: { task_id: taskId },
      });

      if (error) throw error;

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

  // Extrair lista única de responsáveis
  const assignedUsers = useMemo(() => {
    const users = new Set<string>();
    tasks.forEach(task => {
      if (task.assigned_to) {
        users.add(task.assigned_to);
      }
    });
    return Array.from(users).sort();
  }, [tasks]);

  // Filtrar e ordenar tarefas
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
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
  }, [tasks, statusFilter, assignedFilter, priorityFilter]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
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

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status.toLowerCase()) {
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

  if (loading) {
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
        <div className="flex items-start justify-between">
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Tarefa
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Tarefa</DialogTitle>
                <DialogDescription>
                  Preencha os campos abaixo para criar uma nova tarefa no Advbox
                </DialogDescription>
              </DialogHeader>
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
                  <Label htmlFor="due_date">Data de Vencimento</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateTask} className="w-full">
                  Criar Tarefa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

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

              {isAdmin && assignedUsers.length > 0 && (
                <div>
                  <Label htmlFor="assigned-filter">Responsável</Label>
                  <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                    <SelectTrigger id="assigned-filter">
                      <SelectValue placeholder="Filtrar por responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os responsáveis</SelectItem>
                      {assignedUsers.map(user => (
                        <SelectItem key={user} value={user}>{user}</SelectItem>
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
              {filteredTasks.length} de {tasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
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
                    <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTaskDetails(task)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{task.title}</h3>
                              {task.priority && (
                                <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>
                                  {task.priority.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                            )}
                          </div>
                          <Badge variant={getStatusVariant(task.status)} className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
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

        {/* Dialog de Prioridade */}
        <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir Prioridade</DialogTitle>
              <DialogDescription>
                Escolha a prioridade para esta tarefa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={selectedPriority} onValueChange={(value: 'alta' | 'media' | 'baixa') => setSelectedPriority(value)}>
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

        {/* Detalhes da Tarefa com Comentários e Anexos */}
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
                <DrawerDescription>
                  {selectedTask?.description}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>
              </div>
              <DrawerFooter>
                <div className="flex gap-2">
                  {selectedTask?.status !== 'completed' && selectedTask?.status !== 'concluída' && (
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
            <DialogContent className="max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTask?.title}
                  {selectedTask?.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-white border-0`}>
                      {selectedTask.priority.toUpperCase()}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedTask?.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {selectedTask && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-4 border-b">
                    <Badge variant={getStatusVariant(selectedTask.status)} className="flex items-center gap-1">
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.status}
                    </Badge>
                    {selectedTask.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(selectedTask.due_date), 'dd/MM/yyyy', { locale: ptBR })}
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
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="comments">Comentários</TabsTrigger>
                    <TabsTrigger value="attachments">Anexos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="mt-4">
                    {selectedTask && <TaskComments taskId={selectedTask.id} />}
                  </TabsContent>
                  <TabsContent value="attachments" className="mt-4">
                    {selectedTask && <TaskAttachments taskId={selectedTask.id} />}
                  </TabsContent>
                </Tabs>

                {selectedTask?.status !== 'completed' && selectedTask?.status !== 'concluída' && (
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
                      {selectedTask.priority ? 'Alterar Prioridade' : 'Definir Prioridade'}
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
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
