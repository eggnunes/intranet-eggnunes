import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cake, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birthday: string;
}

type FilterType = 'dia' | 'semana' | 'mes';

export default function AniversariosClientes() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('mes');
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomerBirthdays();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [filter, customers]);

  const fetchCustomerBirthdays = async () => {
    try {
      console.log('Fetching customer birthdays...');
      const { data, error } = await supabase.functions.invoke('advbox-integration/customer-birthdays');

      console.log('Customer birthdays response:', { data, error });

      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      // A resposta pode vir em data.data ou diretamente em data
      const customers = data?.data || data || [];
      console.log('Parsed customers:', customers);
      
      setCustomers(customers);
    } catch (error) {
      console.error('Error fetching customer birthdays:', error);
      toast({
        title: 'Erro ao carregar aniversários',
        description: 'Não foi possível carregar os aniversários dos clientes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!customers.length) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter((customer) => {
      const birthday = new Date(customer.birthday);
      
      switch (filter) {
        case 'dia':
          return isToday(birthday);
        case 'semana':
          return isThisWeek(birthday, { weekStartsOn: 0 });
        case 'mes':
          return isThisMonth(birthday);
        default:
          return true;
      }
    });

    // Ordenar por data de aniversário
    filtered.sort((a, b) => {
      const dateA = new Date(a.birthday);
      const dateB = new Date(b.birthday);
      return dateA.getDate() - dateB.getDate();
    });

    setFilteredCustomers(filtered);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando aniversários...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Cake className="h-8 w-8 text-primary" />
            Aniversários de Clientes
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe os aniversários dos seus clientes
          </p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'dia' ? 'default' : 'outline'}
            onClick={() => setFilter('dia')}
            size="sm"
          >
            Hoje
          </Button>
          <Button
            variant={filter === 'semana' ? 'default' : 'outline'}
            onClick={() => setFilter('semana')}
            size="sm"
          >
            Esta Semana
          </Button>
          <Button
            variant={filter === 'mes' ? 'default' : 'outline'}
            onClick={() => setFilter('mes')}
            size="sm"
          >
            Este Mês
          </Button>
        </div>

        {/* Lista de Aniversariantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Aniversariantes
              {filter === 'dia' && ' de Hoje'}
              {filter === 'semana' && ' da Semana'}
              {filter === 'mes' && ' do Mês'}
            </CardTitle>
            <CardDescription>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Cake className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum aniversariante encontrado para este período
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCustomers.map((customer) => (
                    <Card key={customer.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-semibold mb-1">{customer.name}</p>
                            {customer.email && (
                              <p className="text-sm text-muted-foreground">{customer.email}</p>
                            )}
                            {customer.phone && (
                              <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge className="mb-1">
                              {format(new Date(customer.birthday), 'dd/MM', { locale: ptBR })}
                            </Badge>
                            {isToday(new Date(customer.birthday)) && (
                              <div className="text-xs text-primary font-semibold mt-1">Hoje!</div>
                            )}
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
