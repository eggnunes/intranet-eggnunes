import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatusHistory {
  id: string;
  task_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  user_name?: string;
}

interface TaskStatusHistoryProps {
  taskId: string;
}

export function TaskStatusHistory({ taskId }: TaskStatusHistoryProps) {
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [taskId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Buscar nomes dos usuários
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(h => h.changed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const historyWithNames = data.map(h => ({
          ...h,
          user_name: profiles?.find(p => p.id === h.changed_by)?.full_name || 'Usuário desconhecido'
        }));

        setHistory(historyWithNames);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Pendente',
      'in_progress': 'Em Andamento',
      'completed': 'Concluída',
      'unknown': 'Desconhecido'
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === 'completed') return 'default';
    if (status === 'in_progress') return 'secondary';
    return 'secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Carregando histórico...</div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico de Alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="border-l-2 border-primary pl-4 pb-4 relative">
                <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.previous_status && (
                      <>
                        <Badge variant={getStatusVariant(item.previous_status)}>
                          {getStatusLabel(item.previous_status)}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <Badge variant={getStatusVariant(item.new_status)}>
                      {getStatusLabel(item.new_status)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Alterado por <span className="font-medium">{item.user_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(item.changed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  {item.notes && (
                    <div className="text-sm text-muted-foreground italic mt-1">
                      {item.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
