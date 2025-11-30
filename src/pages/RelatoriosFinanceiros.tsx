import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdvboxCacheAlert } from '@/components/AdvboxCacheAlert';
import { AdvboxDataStatus } from '@/components/AdvboxDataStatus';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

export default function RelatoriosFinanceiros() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/transactions', {
        body: { force_refresh: forceRefresh },
      });

      if (error) throw error;

      setTransactions(data?.data || data || []);
      setMetadata(data?.metadata);
      setLastUpdate(new Date());

      if (forceRefresh) {
        toast({
          title: 'Dados atualizados',
          description: 'Os relatórios foram recarregados.',
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erro ao carregar transações',
        description: 'Não foi possível carregar as transações financeiras.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando relatórios...</div>
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
              <DollarSign className="h-8 w-8 text-primary" />
              Relatórios Financeiros
            </h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe suas transações e relatórios financeiros
            </p>
            <div className="mt-2">
              <AdvboxDataStatus lastUpdate={lastUpdate} fromCache={metadata?.fromCache} />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        </div>

        {metadata && <AdvboxCacheAlert metadata={metadata} />}

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalIncome)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpense)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações</CardTitle>
            <CardDescription>
              {transactions.length} {transactions.length === 1 ? 'transação' : 'transações'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {transaction.type === 'income' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <p className="font-semibold">{transaction.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.category}
                              </Badge>
                            </div>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                          </div>
                        </div>
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
