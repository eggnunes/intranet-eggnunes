import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Clock,
  Users,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface MessageLog {
  id: string;
  customer_name: string;
  customer_phone: string;
  days_overdue: number;
  message_template: string;
  status: string;
  sent_at: string;
  error_message?: string;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export function CollectionDashboard() {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('defaulter_messages_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Métricas
  const totalMessages = messages.length;
  const successMessages = messages.filter(m => m.status === 'sent').length;
  const failedMessages = messages.filter(m => m.status === 'failed').length;
  const successRate = totalMessages > 0 ? ((successMessages / totalMessages) * 100).toFixed(1) : '0';

  // Dados para gráficos
  const statusData = [
    { name: 'Enviadas', value: successMessages, color: '#10b981' },
    { name: 'Falhadas', value: failedMessages, color: '#ef4444' },
  ];

  const messagesByDay = messages.reduce((acc: any, msg) => {
    const day = format(new Date(msg.sent_at), 'dd/MM', { locale: ptBR });
    if (!acc[day]) {
      acc[day] = { day, enviadas: 0, falhadas: 0 };
    }
    if (msg.status === 'sent') {
      acc[day].enviadas++;
    } else {
      acc[day].falhadas++;
    }
    return acc;
  }, {});

  const chartData = Object.values(messagesByDay).slice(0, 7).reverse();

  const messagesByTemplate = messages.reduce((acc: any, msg) => {
    if (!acc[msg.message_template]) {
      acc[msg.message_template] = 0;
    }
    acc[msg.message_template]++;
    return acc;
  }, {});

  const templateData = Object.entries(messagesByTemplate).map(([name, value]) => ({
    name,
    value: value as number
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
            <p className="text-xs text-muted-foreground">Últimas 100 mensagens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successMessages}</div>
            <p className="text-xs text-muted-foreground">Com sucesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Falhadas</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedMessages}</div>
            <p className="text-xs text-muted-foreground">Erros no envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">De todas as tentativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mensagens por Dia</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="enviadas" fill="#10b981" name="Enviadas" />
                <Bar dataKey="falhadas" fill="#ef4444" name="Falhadas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status das Mensagens</CardTitle>
            <CardDescription>Distribuição geral</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mensagens</CardTitle>
          <CardDescription>Últimas mensagens de cobrança enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="sent">Enviadas</TabsTrigger>
              <TabsTrigger value="failed">Falhadas</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <MessageList messages={messages} />
            </TabsContent>

            <TabsContent value="sent">
              <MessageList messages={messages.filter(m => m.status === 'sent')} />
            </TabsContent>

            <TabsContent value="failed">
              <MessageList messages={messages.filter(m => m.status === 'failed')} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageList({ messages }: { messages: MessageLog[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma mensagem encontrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{message.customer_name}</span>
                  <Badge variant={message.status === 'sent' ? 'default' : 'destructive'}>
                    {message.status === 'sent' ? 'Enviada' : 'Falhou'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Dias em atraso:</span>{' '}
                  <span className="font-medium text-destructive">{message.days_overdue}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Template:</span>{' '}
                  <span className="font-medium">{message.message_template}</span>
                </div>
                {message.error_message && (
                  <div className="text-sm text-destructive mt-2">
                    <span className="font-medium">Erro:</span> {message.error_message}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}