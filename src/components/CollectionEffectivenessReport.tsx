import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle,
  XCircle,
  Target,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, format } from 'date-fns';
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
  Cell,
  LineChart,
  Line
} from 'recharts';

interface MessageLog {
  id: string;
  customer_id: string;
  customer_name: string;
  days_overdue: number;
  sent_at: string;
  status: string;
}

interface Transaction {
  id: string;
  customer_id?: string;
  customer_name?: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  status?: string;
}

interface EffectivenessMetrics {
  totalMessagesSent: number;
  paymentsReceived: number;
  successRate: number;
  averageTimeToPayment: number;
  byOverdueRange: {
    range: string;
    sent: number;
    paid: number;
    successRate: number;
    avgTimeToPayment: number;
  }[];
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export function CollectionEffectivenessReport() {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar mensagens enviadas
      const { data: messagesData, error: messagesError } = await supabase
        .from('defaulter_messages_log')
        .select('*')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Buscar transações do Advbox via cache
      const advboxResponse = await supabase.functions.invoke('advbox-integration', {
        body: { endpoint: 'transactions' }
      });

      let transactionsData: Transaction[] = [];
      if (advboxResponse.data) {
        const data = advboxResponse.data.data || advboxResponse.data;
        transactionsData = Array.isArray(data) ? data : [];
      }

      setMessages(messagesData || []);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (messages.length === 0 || transactions.length === 0) {
      return {
        totalMessagesSent: 0,
        paymentsReceived: 0,
        successRate: 0,
        averageTimeToPayment: 0,
        byOverdueRange: []
      };
    }

    let paymentsReceived = 0;
    let totalTimeToPayment = 0;
    let paymentsWithTime = 0;

    // Agrupar por faixa de atraso
    const rangeGroups: { [key: string]: { sent: number; paid: number; times: number[] } } = {
      '2-7 dias': { sent: 0, paid: 0, times: [] },
      '8-15 dias': { sent: 0, paid: 0, times: [] },
      '16-30 dias': { sent: 0, paid: 0, times: [] },
      '31+ dias': { sent: 0, paid: 0, times: [] },
    };

    messages.forEach((message) => {
      // Determinar faixa de atraso
      let range = '31+ dias';
      if (message.days_overdue <= 7) range = '2-7 dias';
      else if (message.days_overdue <= 15) range = '8-15 dias';
      else if (message.days_overdue <= 30) range = '16-30 dias';

      rangeGroups[range].sent++;

      // Verificar se houve pagamento após a mensagem
      const messageSentDate = parseISO(message.sent_at);
      
      // Buscar transações do mesmo cliente após a mensagem
      const customerTransactions = transactions.filter(
        (t) => 
          t.customer_id === message.customer_id &&
          t.type === 'income' &&
          t.status === 'paid' &&
          parseISO(t.date) > messageSentDate
      );

      if (customerTransactions.length > 0) {
        // Considera pago se houve transação de pagamento nos 30 dias seguintes
        const paymentTransaction = customerTransactions.find((t) => {
          const paymentDate = parseISO(t.date);
          const daysDiff = differenceInDays(paymentDate, messageSentDate);
          return daysDiff <= 30;
        });

        if (paymentTransaction) {
          paymentsReceived++;
          rangeGroups[range].paid++;

          const paymentDate = parseISO(paymentTransaction.date);
          const timeToPayment = differenceInDays(paymentDate, messageSentDate);
          
          totalTimeToPayment += timeToPayment;
          paymentsWithTime++;
          rangeGroups[range].times.push(timeToPayment);
        }
      }
    });

    const successRate = messages.length > 0 ? (paymentsReceived / messages.length) * 100 : 0;
    const averageTimeToPayment = paymentsWithTime > 0 ? totalTimeToPayment / paymentsWithTime : 0;

    // Calcular métricas por faixa
    const byOverdueRange = Object.entries(rangeGroups).map(([range, data]) => ({
      range,
      sent: data.sent,
      paid: data.paid,
      successRate: data.sent > 0 ? (data.paid / data.sent) * 100 : 0,
      avgTimeToPayment: data.times.length > 0 
        ? data.times.reduce((sum, t) => sum + t, 0) / data.times.length 
        : 0
    }));

    return {
      totalMessagesSent: messages.length,
      paymentsReceived,
      successRate,
      averageTimeToPayment,
      byOverdueRange
    };
  }, [messages, transactions]);

  const pieData = [
    { name: 'Pagos', value: metrics.paymentsReceived, color: '#10b981' },
    { name: 'Não Pagos', value: metrics.totalMessagesSent - metrics.paymentsReceived, color: '#ef4444' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando dados de efetividade...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMessagesSent}</div>
            <p className="text-xs text-muted-foreground">Total de cobranças</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Recebidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.paymentsReceived}</div>
            <p className="text-xs text-muted-foreground">Após cobrança</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.successRate >= 50 ? 'text-green-600' : metrics.successRate >= 30 ? 'text-orange-600' : 'text-red-600'}`}>
              {metrics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">De conversão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.averageTimeToPayment.toFixed(0)} dias
            </div>
            <p className="text-xs text-muted-foreground">Até pagamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Análise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Taxa de Conversão por Faixa de Atraso */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Sucesso por Faixa de Atraso</CardTitle>
            <CardDescription>Efetividade das cobranças por período de inadimplência</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.byOverdueRange}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="successRate" fill="#10b981" name="Taxa de Sucesso (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Resultados</CardTitle>
            <CardDescription>Visão geral de pagamentos vs não pagamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mensagens Enviadas por Faixa */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Faixa de Atraso</CardTitle>
            <CardDescription>Distribuição de mensagens enviadas e pagos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.byOverdueRange}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#3b82f6" name="Mensagens Enviadas" />
                <Bar dataKey="paid" fill="#10b981" name="Pagamentos Recebidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tempo Médio de Pagamento por Faixa */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo Médio de Regularização</CardTitle>
            <CardDescription>Dias até o pagamento por faixa de atraso</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.byOverdueRange}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgTimeToPayment" 
                  stroke="#f59e0b" 
                  name="Tempo Médio (dias)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada por Faixa */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada por Faixa de Atraso</CardTitle>
          <CardDescription>Métricas completas de efetividade</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {metrics.byOverdueRange.map((range, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{range.range}</span>
                    </div>
                    <Badge variant={range.successRate >= 50 ? 'default' : range.successRate >= 30 ? 'secondary' : 'destructive'}>
                      {range.successRate.toFixed(1)}% de sucesso
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Enviadas</p>
                      <p className="text-lg font-bold">{range.sent}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pagas</p>
                      <p className="text-lg font-bold text-green-600">{range.paid}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Não Pagas</p>
                      <p className="text-lg font-bold text-red-600">{range.sent - range.paid}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempo Médio</p>
                      <p className="text-lg font-bold text-blue-600">
                        {range.avgTimeToPayment > 0 ? `${range.avgTimeToPayment.toFixed(1)} dias` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Insights e Recomendações */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle>Insights e Recomendações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.successRate >= 50 && (
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Excelente taxa de conversão!</p>
                  <p className="text-sm text-muted-foreground">
                    Sua estratégia de cobrança está funcionando muito bem. Continue monitorando os resultados.
                  </p>
                </div>
              </div>
            )}
            
            {metrics.successRate < 30 && (
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium">Taxa de conversão abaixo do esperado</p>
                  <p className="text-sm text-muted-foreground">
                    Considere revisar o template de mensagem ou ajustar as faixas de dias para envio automático.
                  </p>
                </div>
              </div>
            )}

            {metrics.averageTimeToPayment > 15 && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium">Tempo médio de pagamento elevado</p>
                  <p className="text-sm text-muted-foreground">
                    Considere enviar lembretes de acompanhamento ou oferecer facilidades de pagamento.
                  </p>
                </div>
              </div>
            )}

            {metrics.byOverdueRange.some(r => r.successRate < 20 && r.sent > 5) && (
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Oportunidade de melhoria identificada</p>
                  <p className="text-sm text-muted-foreground">
                    Algumas faixas de atraso têm baixa conversão. Personalize a abordagem para essas situações.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}