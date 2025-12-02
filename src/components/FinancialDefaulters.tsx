import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Calendar, User, DollarSign, MessageCircle, Ban, Search } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  customer_name?: string;
  due_date?: string;
  status?: 'pending' | 'paid' | 'overdue';
}

interface FinancialDefaultersProps {
  transactions: Transaction[];
}

interface Defaulter {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysPastDue: number;
  phone?: string;
}

export function FinancialDefaulters({ transactions }: FinancialDefaultersProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);

  // Carregar exclusões
  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchExclusions = async () => {
      const { data, error } = await supabase
        .from('defaulter_exclusions')
        .select('customer_id');
      
      if (error) {
        console.error('Error fetching exclusions:', error);
        return;
      }
      
      setExclusions(new Set(data.map(e => e.customer_id)));
    };
    
    fetchExclusions();
  }, [isAdmin]);

  const defaulters = useMemo(() => {
    const now = new Date();
    const defaultersList: Defaulter[] = [];
    
    // Parsear datas de filtro se fornecidas
    const hasDateFilter = startDate && endDate;
    const start = hasDateFilter ? parseISO(startDate) : null;
    const end = hasDateFilter ? parseISO(endDate) : null;

    // Filtrar transações de receita (honorários) que estão em atraso
    transactions
      .filter(t => t.type === 'income' && t.status === 'overdue')
      .forEach(transaction => {
        const dueDate = transaction.due_date ? parseISO(transaction.due_date) : parseISO(transaction.date);
        
        // Se houver filtro de data, aplicar
        if (hasDateFilter && start && end) {
          if (!isWithinInterval(dueDate, { start, end })) {
            return;
          }
        }

        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPastDue > 0) {
          defaultersList.push({
            id: transaction.id,
            name: transaction.customer_name || transaction.description || 'Cliente não identificado',
            amount: transaction.amount,
            dueDate: format(dueDate, "dd/MM/yyyy", { locale: ptBR }),
            daysPastDue,
            phone: (transaction as any).customer_phone,
          });
        }
      });

    // Ordenar por dias em atraso (maior para menor)
    return defaultersList.sort((a, b) => b.daysPastDue - a.daysPastDue);
  }, [transactions, startDate, endDate]);

  const totalOverdue = useMemo(() => {
    return defaulters.reduce((sum, d) => sum + d.amount, 0);
  }, [defaulters]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleSendMessage = async (defaulter: Defaulter) => {
    if (!defaulter.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    setSendingMessage(defaulter.id);

    try {
      const { data, error } = await supabase.functions.invoke('send-defaulter-message', {
        body: {
          customerId: defaulter.id,
          customerName: defaulter.name,
          customerPhone: defaulter.phone,
          amount: defaulter.amount,
          daysOverdue: defaulter.daysPastDue,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Mensagem enviada para ${defaulter.name}`);
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSendingMessage(null);
    }
  };

  const handleToggleExclusion = async (defaulter: Defaulter) => {
    const isExcluded = exclusions.has(defaulter.id);

    try {
      if (isExcluded) {
        // Remover exclusão
        const { error } = await supabase
          .from('defaulter_exclusions')
          .delete()
          .eq('customer_id', defaulter.id);

        if (error) throw error;

        setExclusions(prev => {
          const next = new Set(prev);
          next.delete(defaulter.id);
          return next;
        });

        toast.success(`${defaulter.name} voltará a receber mensagens`);
      } else {
        // Adicionar exclusão
        const { error } = await supabase
          .from('defaulter_exclusions')
          .insert({
            customer_id: defaulter.id,
            customer_name: defaulter.name,
            excluded_by: user?.id,
            reason: 'Marcado manualmente pelo administrador',
          });

        if (error) throw error;

        setExclusions(prev => new Set(prev).add(defaulter.id));

        toast.success(`${defaulter.name} não receberá mais mensagens automáticas`);
      }
    } catch (error: any) {
      console.error('Error toggling exclusion:', error);
      toast.error('Erro ao atualizar exclusão');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Inadimplentes
            </CardTitle>
            <CardDescription>
              Clientes com pagamentos em atraso
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total em atraso</div>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalOverdue)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros de Data */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Data Inicial</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Data Final</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>

        {/* Lista de Inadimplentes */}
        {defaulters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum inadimplente encontrado no período selecionado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {defaulters.map((defaulter, index) => {
                const isExcluded = exclusions.has(defaulter.id);
                return (
                  <div
                    key={`${defaulter.id}-${index}`}
                    className={`border rounded-lg p-4 transition-colors ${
                      isExcluded ? 'opacity-60 border-destructive' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{defaulter.name}</span>
                          {isExcluded && (
                            <Badge variant="outline" className="border-destructive text-destructive">
                              <Ban className="h-3 w-3 mr-1" />
                              Não enviar
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Vencimento: {defaulter.dueDate}</span>
                        </div>
                        <Badge variant="destructive" className="mt-1">
                          {defaulter.daysPastDue} {defaulter.daysPastDue === 1 ? 'dia' : 'dias'} em atraso
                        </Badge>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1 text-destructive font-bold">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(defaulter.amount)}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={isExcluded ? "outline" : "default"}
                              onClick={() => handleToggleExclusion(defaulter)}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              {isExcluded ? 'Desmarcar' : 'Não enviar'}
                            </Button>
                            {defaulter.phone && !isExcluded && (
                              <Button
                                size="sm"
                                onClick={() => handleSendMessage(defaulter)}
                                disabled={sendingMessage === defaulter.id}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                {sendingMessage === defaulter.id ? 'Enviando...' : 'Enviar cobrança'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Estatísticas */}
        {defaulters.length > 0 && (
          <div className="border-t pt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-destructive">{defaulters.length}</div>
              <div className="text-xs text-muted-foreground">Inadimplentes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(defaulters.reduce((sum, d) => sum + d.daysPastDue, 0) / defaulters.length)}
              </div>
              <div className="text-xs text-muted-foreground">Dias médio de atraso</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {Math.max(...defaulters.map(d => d.daysPastDue))}
              </div>
              <div className="text-xs text-muted-foreground">Maior atraso (dias)</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
