import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO, isPast, isFuture } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
}

export const TaskNotifications = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { profile } = useUserRole();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/tasks', {
        body: { force_refresh: false },
      });

      if (error) throw error;

      let tasksData = [];
      if (data?.data && Array.isArray(data.data)) {
        tasksData = data.data;
      } else if (Array.isArray(data)) {
        tasksData = data;
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        tasksData = data.tasks || data.items || [];
      }

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

      setTasks(Array.isArray(tasksWithPriorities) ? tasksWithPriorities : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar tarefas do usuário atual
  const userTasks = useMemo(() => {
    if (!profile?.full_name) return [];

    const currentName = profile.full_name.toLowerCase();

    return tasks.filter((task) => {
      const isPending = task.status?.toLowerCase() === 'pending' || task.status?.toLowerCase() === 'pendente';
      const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'em andamento';
      const isUserTask = task.assigned_to && task.assigned_to.toLowerCase().includes(currentName);

      return (isPending || isInProgress) && isUserTask && task.due_date;
    });
  }, [tasks, profile?.full_name]);

  // Categorizar tarefas
  const categorizedTasks = useMemo(() => {
    const overdue: Task[] = [];
    const dueToday: Task[] = [];
    const dueSoon: Task[] = [];

    const today = new Date();

    userTasks.forEach((task) => {
      if (!task.due_date) return;

      try {
        const dueDate = parseISO(task.due_date);
        const daysUntilDue = differenceInDays(dueDate, today);

        if (isPast(dueDate) && daysUntilDue < 0) {
          overdue.push(task);
        } else if (daysUntilDue === 0) {
          dueToday.push(task);
        } else if (daysUntilDue > 0 && daysUntilDue <= 3) {
          dueSoon.push(task);
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    });

    return { overdue, dueToday, dueSoon };
  }, [userTasks]);

  const totalCriticalTasks = categorizedTasks.overdue.length + categorizedTasks.dueToday.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Alertas de Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Carregando alertas...</div>
        </CardContent>
      </Card>
    );
  }

  if (totalCriticalTasks === 0 && categorizedTasks.dueSoon.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Alertas de Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Você não tem tarefas urgentes no momento. Continue assim! 🎉
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas de Tarefas
          {totalCriticalTasks > 0 && (
            <Badge variant="destructive" className="ml-2">
              {totalCriticalTasks}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Tarefas que precisam de atenção imediata</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tarefas Atrasadas */}
        {categorizedTasks.overdue.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Atrasadas ({categorizedTasks.overdue.length})
            </h4>
            <div className="space-y-2">
              {categorizedTasks.overdue.slice(0, 3).map((task) => {
                const daysOverdue = Math.abs(differenceInDays(parseISO(task.due_date), new Date()));
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="destructive" className="text-xs">
                            {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} atrasada
                          </Badge>
                          {task.priority && (
                            <Badge
                              variant="outline"
                              className={
                                task.priority === 'alta'
                                  ? 'border-red-500 text-red-500 text-xs'
                                  : task.priority === 'media'
                                  ? 'border-yellow-500 text-yellow-500 text-xs'
                                  : 'border-green-500 text-green-500 text-xs'
                              }
                            >
                              {task.priority.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tarefas para Hoje */}
        {categorizedTasks.dueToday.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Vence Hoje ({categorizedTasks.dueToday.length})
            </h4>
            <div className="space-y-2">
              {categorizedTasks.dueToday.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-900">
                          Vence hoje
                        </Badge>
                        {task.priority && (
                          <Badge
                            variant="outline"
                            className={
                              task.priority === 'alta'
                                ? 'border-red-500 text-red-500 text-xs'
                                : task.priority === 'media'
                                ? 'border-yellow-500 text-yellow-500 text-xs'
                                : 'border-green-500 text-green-500 text-xs'
                            }
                          >
                            {task.priority.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarefas Próximas */}
        {categorizedTasks.dueSoon.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Próximas do Vencimento ({categorizedTasks.dueSoon.length})
            </h4>
            <div className="space-y-2">
              {categorizedTasks.dueSoon.slice(0, 2).map((task) => {
                const daysUntilDue = differenceInDays(parseISO(task.due_date), new Date());
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs bg-blue-200 text-blue-900">
                            {daysUntilDue} {daysUntilDue === 1 ? 'dia' : 'dias'}
                          </Badge>
                          {task.priority && (
                            <Badge
                              variant="outline"
                              className={
                                task.priority === 'alta'
                                  ? 'border-red-500 text-red-500 text-xs'
                                  : task.priority === 'media'
                                  ? 'border-yellow-500 text-yellow-500 text-xs'
                                  : 'border-green-500 text-green-500 text-xs'
                              }
                            >
                              {task.priority.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate('/tarefas-advbox')}
        >
          Ver Todas as Tarefas
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};
