import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Gavel, Clock, AlertTriangle, FileText, Scale, MessageSquare, File, Circle } from 'lucide-react';
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
  category?: string;
}

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

type ViewMode = 'month' | 'week';

// Configuração de cores e ícones por categoria
const categoryConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode; label: string }> = {
  audiencia: {
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    borderColor: 'border-l-purple-500',
    icon: <Gavel className="h-3 w-3" />,
    label: 'Audiência',
  },
  prazo: {
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    borderColor: 'border-l-red-500',
    icon: <Clock className="h-3 w-3" />,
    label: 'Prazo',
  },
  intimacao: {
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    borderColor: 'border-l-orange-500',
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Intimação',
  },
  sentenca: {
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/40',
    borderColor: 'border-l-indigo-500',
    icon: <Scale className="h-3 w-3" />,
    label: 'Sentença',
  },
  recurso: {
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/40',
    borderColor: 'border-l-cyan-500',
    icon: <FileText className="h-3 w-3" />,
    label: 'Recurso',
  },
  despacho: {
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-100 dark:bg-teal-900/40',
    borderColor: 'border-l-teal-500',
    icon: <MessageSquare className="h-3 w-3" />,
    label: 'Despacho',
  },
  peticao: {
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    borderColor: 'border-l-blue-500',
    icon: <File className="h-3 w-3" />,
    label: 'Petição',
  },
  outro: {
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/40',
    borderColor: 'border-l-gray-500',
    icon: <Circle className="h-3 w-3" />,
    label: 'Outro',
  },
};

const defaultCategoryConfig = {
  color: 'text-slate-700 dark:text-slate-300',
  bgColor: 'bg-slate-100 dark:bg-slate-800/40',
  borderColor: 'border-l-slate-400',
  icon: <Circle className="h-3 w-3" />,
  label: 'Sem categoria',
};

export const TaskCalendarView = ({ tasks, onTaskClick }: TaskCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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

  const filteredTasks = useMemo(() => {
    if (categoryFilter === 'all') return tasks;
    return tasks.filter((task) => task.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const getTasksForDay = (day: Date) => {
    return filteredTasks.filter((task) => {
      if (!task.due_date) return false;
      try {
        const taskDate = parseISO(task.due_date);
        return isValid(taskDate) && isSameDay(taskDate, day);
      } catch {
        return false;
      }
    });
  };

  // Detectar categoria a partir do título se não tiver categoria definida
  const detectCategory = (task: Task): string => {
    if (task.category) return task.category.toLowerCase();
    
    const title = task.title?.toLowerCase() || '';
    const description = task.description?.toLowerCase() || '';
    const combined = `${title} ${description}`;
    
    if (combined.includes('audiência') || combined.includes('audiencia')) return 'audiencia';
    if (combined.includes('prazo') || combined.includes('fatal')) return 'prazo';
    if (combined.includes('intimação') || combined.includes('intimacao') || combined.includes('intimar')) return 'intimacao';
    if (combined.includes('sentença') || combined.includes('sentenca')) return 'sentenca';
    if (combined.includes('recurso') || combined.includes('apelação') || combined.includes('agravo')) return 'recurso';
    if (combined.includes('despacho')) return 'despacho';
    if (combined.includes('petição') || combined.includes('peticao') || combined.includes('protocolo')) return 'peticao';
    
    return '';
  };

  const getCategoryConfig = (task: Task) => {
    const category = detectCategory(task);
    return categoryConfig[category] || defaultCategoryConfig;
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

  const getStatusIndicator = (status?: string) => {
    const normalized = status?.toLowerCase() ?? '';
    switch (normalized) {
      case 'completed':
      case 'concluída':
        return 'opacity-60 line-through';
      default:
        return '';
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Extrair categorias únicas das tarefas
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    tasks.forEach((task) => {
      const category = detectCategory(task);
      if (category) categories.add(category);
    });
    return Array.from(categories).sort();
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Tarefas
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Todas categorias</SelectItem>
                {uniqueCategories.map((cat) => {
                  const config = categoryConfig[cat];
                  return (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        {config?.icon}
                        {config?.label || cat}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
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
                    {dayTasks.slice(0, viewMode === 'month' ? 3 : 10).map((task) => {
                      const config = getCategoryConfig(task);
                      return (
                        <button
                          key={task.id}
                          onClick={() => onTaskClick(task)}
                          className={cn(
                            "w-full text-left text-xs p-1.5 rounded border-l-2 truncate hover:opacity-80 transition-all",
                            config.bgColor,
                            config.borderColor,
                            config.color,
                            getStatusIndicator(task.status)
                          )}
                          title={`${config.label}: ${task.title}`}
                        >
                          <div className="flex items-center gap-1">
                            {config.icon}
                            <span className="truncate flex-1">{task.title}</span>
                          </div>
                        </button>
                      );
                    })}
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

        {/* Legend - Categorias */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-3">Legenda por Tipo de Tarefa:</p>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(categoryConfig).map(([key, config]) => (
              <div 
                key={key} 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md",
                  config.bgColor,
                  config.color
                )}
              >
                {config.icon}
                <span>{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
