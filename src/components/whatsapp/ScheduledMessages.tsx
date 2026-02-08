import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Clock, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScheduledMessage {
  id: string;
  phone: string;
  contact_name: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

function formatPhone(phone: string): string {
  if (phone.startsWith('55') && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    if (number.length === 9) return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }
  return phone;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  sent: { label: 'Enviada', variant: 'default', icon: Check },
  cancelled: { label: 'Cancelada', variant: 'secondary', icon: X },
  failed: { label: 'Falhou', variant: 'destructive', icon: AlertTriangle },
};

export function ScheduledMessages() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('whatsapp_scheduled_messages')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setMessages(data as ScheduledMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('whatsapp_scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    } else {
      toast({ title: 'Agendamento cancelado' });
      fetchMessages();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Mensagens Agendadas</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma mensagem agendada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Agendada para</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map(msg => {
                const config = statusConfig[msg.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                return (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{msg.contact_name || formatPhone(msg.phone)}</p>
                        <p className="text-xs text-muted-foreground">{formatPhone(msg.phone)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-xs">{msg.content || `[${msg.message_type}]`}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                      {msg.error_message && (
                        <p className="text-xs text-destructive mt-1">{msg.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {msg.status === 'pending' && (
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(msg.id)} className="text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
