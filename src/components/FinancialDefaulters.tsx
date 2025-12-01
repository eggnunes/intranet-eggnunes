import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Calendar, User, DollarSign } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  name: string;
  amount: number;
  dueDate: string;
  daysPastDue: number;
}

export function FinancialDefaulters({ transactions }: FinancialDefaultersProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const defaulters = useMemo(() => {
    const now = new Date();
    const defaultersList: Defaulter[] = [];

    // Filtrar transações de receita (honorários) que estão em atraso
    transactions
      .filter(t => t.type === 'income' && t.status === 'overdue')
      .forEach(transaction => {
        const dueDate = transaction.due_date ? parseISO(transaction.due_date) : parseISO(transaction.date);
        
        // Se há filtro de data, aplicar
        if (startDate && endDate) {
          const start = parseISO(startDate);
          const end = parseISO(endDate);
          if (!isWithinInterval(dueDate, { start, end })) {
            return;
          }
        }

        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPastDue > 0) {
          defaultersList.push({
            name: transaction.customer_name || transaction.description || 'Cliente não identificado',
            amount: transaction.amount,
            dueDate: format(dueDate, "dd/MM/yyyy", { locale: ptBR }),
            daysPastDue,
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
              {defaulters.map((defaulter, index) => (
                <div
                  key={`${defaulter.name}-${index}`}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{defaulter.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Vencimento: {defaulter.dueDate}</span>
                      </div>
                      <Badge variant="destructive" className="mt-1">
                        {defaulter.daysPastDue} {defaulter.daysPastDue === 1 ? 'dia' : 'dias'} em atraso
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-destructive font-bold">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(defaulter.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
