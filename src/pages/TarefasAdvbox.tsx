import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Plus, Filter, CheckCircle2, Clock, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';
import { useUserRole } from '@/hooks/useUserRole';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
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
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

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
      
      setTasks(Array.isArray(tasksData) ? tasksData : []);
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

  // Filtrar tarefas
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (assignedFilter !== 'all' && task.assigned_to !== assignedFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, assignedFilter]);

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                          <Badge variant={getStatusVariant(task.status)} className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Vencimento: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                          {task.assigned_to && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assigned_to}
                            </span>
                          )}
                        </div>

                        {task.status !== 'completed' && task.status !== 'concluída' && (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteTask(task.id)}
                              className="flex-1"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Marcar como Concluída
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
