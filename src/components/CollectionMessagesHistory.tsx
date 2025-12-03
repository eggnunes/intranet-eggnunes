import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Search, CheckCircle, XCircle, Clock, User, Phone, Calendar, Gift, FileText, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CollectionMessageLog {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  days_overdue: number;
  message_template: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface BirthdayMessageLog {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  message_text: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

type MessageType = 'all' | 'collection' | 'documents' | 'birthday';

export function CollectionMessagesHistory() {
  const [collectionMessages, setCollectionMessages] = useState<CollectionMessageLog[]>([]);
  const [birthdayMessages, setBirthdayMessages] = useState<BirthdayMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<MessageType>('all');

  useEffect(() => {
    fetchAllMessages();
  }, []);

  const fetchAllMessages = async () => {
    try {
      // Buscar mensagens de cobrança (honorários e documentos)
      const { data: collectionData, error: collectionError } = await supabase
        .from('defaulter_messages_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (collectionError) throw collectionError;
      setCollectionMessages(collectionData || []);

      // Buscar mensagens de aniversário
      const { data: birthdayData, error: birthdayError } = await supabase
        .from('chatguru_birthday_messages_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (birthdayError) throw birthdayError;
      setBirthdayMessages(birthdayData || []);
    } catch (error) {
      console.error('Error fetching message history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Separar mensagens de cobrança de honorários e documentos
  const honorariosMessages = collectionMessages.filter(m => m.message_template === 'boletoematraso');
  const documentosMessages = collectionMessages.filter(m => m.message_template === 'cobrancadocumentosparaacao');

  // Filtrar mensagens por busca
  const filterBySearch = <T extends { customer_name: string; customer_phone: string }>(messages: T[]) => {
    if (!searchTerm) return messages;
    return messages.filter(msg =>
      msg.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.customer_phone.includes(searchTerm)
    );
  };

  // Combinar todas as mensagens em uma lista única ordenada por data
  const getAllMessages = () => {
    const allMsgs = [
      ...collectionMessages.map(m => ({
        ...m,
        type: m.message_template === 'boletoematraso' ? 'collection' : 'documents' as const,
      })),
      ...birthdayMessages.map(m => ({
        ...m,
        type: 'birthday' as const,
        days_overdue: 0,
        message_template: 'aniversario',
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return filterBySearch(allMsgs);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviada
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'collection':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            <CreditCard className="h-3 w-3 mr-1" />
            Honorários
          </Badge>
        );
      case 'documents':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            <FileText className="h-3 w-3 mr-1" />
            Documentos
          </Badge>
        );
      case 'birthday':
        return (
          <Badge variant="outline" className="border-pink-500 text-pink-600">
            <Gift className="h-3 w-3 mr-1" />
            Aniversário
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Estatísticas
  const stats = {
    total: collectionMessages.length + birthdayMessages.length,
    honorarios: {
      total: honorariosMessages.length,
      sent: honorariosMessages.filter(m => m.status === 'sent').length,
      failed: honorariosMessages.filter(m => m.status === 'failed').length,
    },
    documentos: {
      total: documentosMessages.length,
      sent: documentosMessages.filter(m => m.status === 'sent').length,
      failed: documentosMessages.filter(m => m.status === 'failed').length,
    },
    aniversario: {
      total: birthdayMessages.length,
      sent: birthdayMessages.filter(m => m.status === 'sent').length,
      failed: birthdayMessages.filter(m => m.status === 'failed').length,
    },
  };

  const renderMessageList = (messages: any[], showType: boolean = false) => {
    if (messages.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{searchTerm ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem enviada ainda'}</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={`${msg.type || 'msg'}-${msg.id}`}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Cliente e Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{msg.customer_name}</span>
                    {getStatusBadge(msg.status)}
                    {showType && msg.type && getTypeBadge(msg.type)}
                    {msg.days_overdue > 0 && (
                      <Badge variant="outline">
                        {msg.days_overdue} {msg.days_overdue === 1 ? 'dia' : 'dias'} em atraso
                      </Badge>
                    )}
                  </div>

                  {/* Telefone */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{msg.customer_phone}</span>
                  </div>

                  {/* Data de envio */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {msg.sent_at ? formatDate(msg.sent_at) : formatDate(msg.created_at)}
                    </span>
                  </div>

                  {/* Erro (se houver) */}
                  {msg.error_message && (
                    <div className="text-sm text-destructive mt-2">
                      Erro: {msg.error_message}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Template: {msg.message_template || 'aniversario'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Histórico de Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Carregando histórico...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Histórico de Mensagens Enviadas
            </CardTitle>
            <CardDescription>
              Todas as mensagens enviadas via WhatsApp (ChatGuru)
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-muted-foreground text-xs">Total</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou telefone..."
            className="pl-9"
          />
        </div>

        {/* Tabs por tipo de mensagem */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MessageType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">
              Todas ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="collection" className="text-xs">
              <CreditCard className="h-3 w-3 mr-1" />
              Honorários ({stats.honorarios.total})
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Documentos ({stats.documentos.total})
            </TabsTrigger>
            <TabsTrigger value="birthday" className="text-xs">
              <Gift className="h-3 w-3 mr-1" />
              Aniversário ({stats.aniversario.total})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {/* Stats resumo */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-lg text-center">
                <div className="text-lg font-bold text-amber-600">{stats.honorarios.sent}/{stats.honorarios.total}</div>
                <div className="text-xs text-muted-foreground">Honorários enviadas</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <div className="text-lg font-bold text-blue-600">{stats.documentos.sent}/{stats.documentos.total}</div>
                <div className="text-xs text-muted-foreground">Documentos enviadas</div>
              </div>
              <div className="p-3 bg-pink-500/10 rounded-lg text-center">
                <div className="text-lg font-bold text-pink-600">{stats.aniversario.sent}/{stats.aniversario.total}</div>
                <div className="text-xs text-muted-foreground">Aniversário enviadas</div>
              </div>
            </div>
            {renderMessageList(getAllMessages(), true)}
          </TabsContent>

          <TabsContent value="collection" className="mt-4">
            <div className="flex gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-green-600">{stats.honorarios.sent}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-destructive">{stats.honorarios.failed}</div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
            </div>
            {renderMessageList(filterBySearch(honorariosMessages))}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <div className="flex gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-green-600">{stats.documentos.sent}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-destructive">{stats.documentos.failed}</div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
            </div>
            {renderMessageList(filterBySearch(documentosMessages))}
          </TabsContent>

          <TabsContent value="birthday" className="mt-4">
            <div className="flex gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-green-600">{stats.aniversario.sent}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center flex-1">
                <div className="text-lg font-bold text-destructive">{stats.aniversario.failed}</div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
            </div>
            {renderMessageList(filterBySearch(birthdayMessages.map(m => ({ ...m, type: 'birthday', days_overdue: 0, message_template: 'aniversario' }))))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
