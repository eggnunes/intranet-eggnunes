import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  status: string;
  assigned_to?: string;
  priority?: 'alta' | 'media' | 'baixa';
  process_number?: string;
}

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

type ViewMode = 'month' | 'week';

export const TaskCalendarView = ({ tasks, onTaskClick }: TaskCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const getDaysToDisplay = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
      const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.due_date) return false;
      try {
        const taskDate = parseISO(task.due_date);
        return isValid(taskDate) && isSameDay(taskDate, day);
      } catch {
        return false;
      }
    });
  };

  const handlePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'alta':
        return 'bg-red-500 text-white';
      case 'media':
        return 'bg-yellow-500 text-black';
      case 'baixa':
        return 'bg-green-500 text-white';
      default:
        return 'bg-primary/20 text-primary-foreground';
    }
  };

  const getStatusColor = (status?: string) => {
    const normalized = status?.toLowerCase() ?? '';
    switch (normalized) {
      case 'completed':
      case 'concluída':
        return 'border-l-green-500';
      case 'pending':
      case 'pendente':
        return 'border-l-yellow-500';
      case 'in_progress':
      case 'em andamento':
        return 'border-l-blue-500';
      default:
        return 'border-l-muted';
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Tarefas
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Mensal
                  </div>
                </SelectItem>
                <SelectItem value="week">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Semanal
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoje
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-semibold capitalize">
            {viewMode === 'month'
              ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
              : `Semana de ${format(startOfWeek(currentDate, { locale: ptBR }), 'd MMM', { locale: ptBR })} - ${format(endOfWeek(currentDate, { locale: ptBR }), 'd MMM yyyy', { locale: ptBR })}`}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className={cn(
          "grid grid-cols-7 gap-1",
          viewMode === 'week' ? 'min-h-[300px]' : ''
        )}>
          {getDaysToDisplay.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[100px] p-1 border rounded-lg transition-colors",
                  isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                  isToday && 'ring-2 ring-primary',
                  viewMode === 'week' && 'min-h-[250px]'
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1 text-center rounded-full w-7 h-7 flex items-center justify-center mx-auto",
                  isToday && 'bg-primary text-primary-foreground',
                  !isCurrentMonth && 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                </div>
                <ScrollArea className={cn(
                  viewMode === 'month' ? 'h-[60px]' : 'h-[200px]'
                )}>
                  <div className="space-y-1">
                    {dayTasks.slice(0, viewMode === 'month' ? 3 : 10).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={cn(
                          "w-full text-left text-xs p-1 rounded border-l-2 truncate hover:bg-accent transition-colors",
                          getStatusColor(task.status)
                        )}
                        title={task.title}
                      >
                        <span className="truncate block">{task.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > (viewMode === 'month' ? 3 : 10) && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{dayTasks.length - (viewMode === 'month' ? 3 : 10)} mais
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-2 border-l-green-500 bg-muted" />
            <span className="text-muted-foreground">Concluída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-2 border-l-yellow-500 bg-muted" />
            <span className="text-muted-foreground">Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-2 border-l-blue-500 bg-muted" />
            <span className="text-muted-foreground">Em andamento</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
