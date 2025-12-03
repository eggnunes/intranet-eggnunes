import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Search, AlertCircle, CheckCircle2, MessageSquare, Cake, FileText, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  message_text: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  chatguru_message_id: string | null;
  created_at: string;
  type: 'birthday' | 'collection' | 'documents';
  days_overdue?: number;
  message_template?: string;
}

export default function HistoricoMensagensAniversario() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllMessages();
    }
  }, [isAdmin]);

  useEffect(() => {
    applyFilters();
  }, [messages, searchTerm, statusFilter, typeFilter, startDate, endDate]);

  const fetchAllMessages = async () => {
    try {
      setLoading(true);
      
      // Buscar mensagens de aniversário
      const { data: birthdayData, error: birthdayError } = await supabase
        .from('chatguru_birthday_messages_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (birthdayError) throw birthdayError;

      // Buscar mensagens de cobrança e documentos
      const { data: collectionData, error: collectionError } = await supabase
        .from('defaulter_messages_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (collectionError) throw collectionError;

      // Mapear e combinar todas as mensagens
      const birthdayMessages: Message[] = (birthdayData || []).map(msg => ({
        id: msg.id,
        customer_id: msg.customer_id,
        customer_name: msg.customer_name,
        customer_phone: msg.customer_phone,
        message_text: msg.message_text,
        status: msg.status,
        sent_at: msg.sent_at,
        error_message: msg.error_message,
        chatguru_message_id: msg.chatguru_message_id,
        created_at: msg.created_at,
        type: 'birthday' as const,
      }));

      const collectionMessages: Message[] = (collectionData || []).map(msg => ({
        id: msg.id,
        customer_id: msg.customer_id,
        customer_name: msg.customer_name,
        customer_phone: msg.customer_phone,
        message_text: msg.message_text,
        status: msg.status,
        sent_at: msg.sent_at,
        error_message: msg.error_message,
        chatguru_message_id: msg.chatguru_message_id,
        created_at: msg.created_at,
        type: msg.message_template === 'cobrancadocumentosparaacao' ? 'documents' as const : 'collection' as const,
        days_overdue: msg.days_overdue,
        message_template: msg.message_template,
      }));

      // Combinar e ordenar por data
      const allMessages = [...birthdayMessages, ...collectionMessages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMessages(allMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar histórico de mensagens');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...messages];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter((msg) => msg.type === typeFilter);
    }

    // Filter by search term (customer name or phone)
    if (searchTerm) {
      filtered = filtered.filter(
        (msg) =>
          msg.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          msg.customer_phone.includes(searchTerm)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((msg) => msg.status === statusFilter);
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((msg) => {
        const msgDate = new Date(msg.created_at);
        return msgDate >= startDate;
      });
    }

    if (endDate) {
      filtered = filtered.filter((msg) => {
        const msgDate = new Date(msg.created_at);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return msgDate <= endOfDay;
      });
    }

    setFilteredMessages(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'birthday':
        return <Cake className="h-4 w-4" />;
      case 'collection':
        return <DollarSign className="h-4 w-4" />;
      case 'documents':
        return <FileText className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'birthday':
        return 'Aniversário';
      case 'collection':
        return 'Cobrança';
      case 'documents':
        return 'Documentos';
      default:
        return 'Outro';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'birthday':
        return 'default';
      case 'collection':
        return 'secondary';
      case 'documents':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const sentCount = filteredMessages.filter((m) => m.status === 'sent').length;
  const failedCount = filteredMessages.filter((m) => m.status === 'failed').length;
  const birthdayCount = filteredMessages.filter((m) => m.type === 'birthday').length;
  const collectionCount = filteredMessages.filter((m) => m.type === 'collection').length;
  const documentsCount = filteredMessages.filter((m) => m.type === 'documents').length;

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Histórico de Mensagens
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe todas as mensagens enviadas via WhatsApp (aniversário, cobrança e documentos)
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredMessages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Enviadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{sentCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Falhadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <Cake className="h-4 w-4" /> Aniversário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{birthdayCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Cobrança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collectionCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <FileText className="h-4 w-4" /> Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentsCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtre as mensagens por tipo, data, status ou cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="birthday">Aniversário</SelectItem>
                    <SelectItem value="collection">Cobrança</SelectItem>
                    <SelectItem value="documents">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sent">Enviadas</SelectItem>
                    <SelectItem value="failed">Falhadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>

        {/* Tabela de Mensagens */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens Enviadas</CardTitle>
            <CardDescription>
              {filteredMessages.length} {filteredMessages.length === 1 ? 'mensagem' : 'mensagens'}{' '}
              encontrada{filteredMessages.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMessages.map((message) => (
                      <TableRow key={`${message.type}-${message.id}`}>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(message.type) as any} className="flex items-center gap-1 w-fit">
                            {getTypeIcon(message.type)}
                            {getTypeLabel(message.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{message.customer_name}</TableCell>
                        <TableCell>{message.customer_phone}</TableCell>
                        <TableCell>
                          {message.status === 'sent' ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Enviada
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Falhou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {message.status === 'failed' && message.error_message && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Ver Erro
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Detalhes do Erro</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {message.error_message}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                          {message.type === 'collection' && message.days_overdue && (
                            <span className="text-xs text-muted-foreground">
                              {message.days_overdue} dias em atraso
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
