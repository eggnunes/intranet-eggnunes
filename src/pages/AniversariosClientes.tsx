import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cake, Calendar, Copy } from 'lucide-react';
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

      console.log('Customer birthdays raw response:', { data, error });

      if (error) {
        console.error('Error from edge function:', error);
        throw error;
      }

      const rawCustomers: any[] = (data as any)?.data || (data as any) || [];

      const normalizedCustomers: Customer[] = rawCustomers
        .map((c) => {
          // birthdate vem da API no formato dd/MM/yyyy
          let birthdayIso = '';
          const rawBirth = c.birthdate || c.birthday;

          if (rawBirth) {
            const parts = String(rawBirth).split(/[\/\-]/); // aceita 06/11/1933
            if (parts.length === 3) {
              const [day, month, year] = parts;
              const date = new Date(Number(year), Number(month) - 1, Number(day));
              if (!isNaN(date.getTime())) {
                birthdayIso = date.toISOString();
              }
            } else {
              const date = new Date(rawBirth);
              if (!isNaN(date.getTime())) {
                birthdayIso = date.toISOString();
              }
            }
          }

          if (!birthdayIso) return null;

          return {
            id: String(c.id ?? c.customer_id ?? ''),
            name: c.name ?? '',
            email: c.email ?? undefined,
            phone: c.phone ?? c.cellphone ?? undefined,
            birthday: birthdayIso,
          } as Customer;
        })
        .filter((c): c is Customer => c !== null);

      console.log('Normalized customers:', normalizedCustomers);
      setCustomers(normalizedCustomers);
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

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filtered = customers.filter((customer) => {
      const birthday = new Date(customer.birthday);
      const birthDay = birthday.getDate();
      const birthMonth = birthday.getMonth();
      
      switch (filter) {
        case 'dia':
          // Aniversário hoje: mesmo dia e mês
          return birthDay === currentDay && birthMonth === currentMonth;
        
        case 'semana':
          // Aniversário nesta semana: dentro dos próximos 7 dias (considerando apenas mês/dia)
          const weekEnd = new Date(currentYear, currentMonth, currentDay + 7);
          const birthThisYear = new Date(currentYear, birthMonth, birthDay);
          
          // Se o aniversário já passou este ano, considera para o ano que vem
          const birthToCompare = birthThisYear < now 
            ? new Date(currentYear + 1, birthMonth, birthDay)
            : birthThisYear;
          
          return birthToCompare >= now && birthToCompare <= weekEnd;
        
        case 'mes':
          // Aniversário neste mês: mesmo mês (independente do ano)
          return birthMonth === currentMonth;
        
        default:
          return true;
      }
    });

    // Ordenar por dia do mês
    filtered.sort((a, b) => {
      const dateA = new Date(a.birthday);
      const dateB = new Date(b.birthday);
      return dateA.getDate() - dateB.getDate();
    });

    setFilteredCustomers(filtered);
  };

  const copyContactsToClipboard = async () => {
    if (filteredCustomers.length === 0) {
      toast({
        title: 'Nenhum contato para copiar',
        description: 'Não há aniversariantes no período selecionado.',
        variant: 'destructive',
      });
      return;
    }

    const filterLabel = 
      filter === 'dia' ? 'Hoje' :
      filter === 'semana' ? 'Esta Semana' :
      'Este Mês';

    let textToCopy = `📅 Aniversariantes - ${filterLabel}\n`;
    textToCopy += `Total: ${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'cliente' : 'clientes'}\n`;
    textToCopy += `\n`;

    filteredCustomers.forEach((customer, index) => {
      const birthday = new Date(customer.birthday);
      const day = birthday.getDate().toString().padStart(2, '0');
      const month = (birthday.getMonth() + 1).toString().padStart(2, '0');
      
      textToCopy += `${index + 1}. ${customer.name}\n`;
      textToCopy += `   📅 ${day}/${month}\n`;
      
      if (customer.phone) {
        textToCopy += `   📱 ${customer.phone}\n`;
      }
      
      if (customer.email) {
        textToCopy += `   📧 ${customer.email}\n`;
      }
      
      textToCopy += `\n`;
    });

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: 'Contatos copiados!',
        description: `${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'contato foi copiado' : 'contatos foram copiados'} para a área de transferência.`,
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar os contatos. Tente novamente.',
        variant: 'destructive',
      });
    }
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
        <div className="flex flex-wrap items-center gap-2">
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
          
          {filteredCustomers.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={copyContactsToClipboard}
              className="ml-auto"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Contatos ({filteredCustomers.length})
            </Button>
          )}
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
