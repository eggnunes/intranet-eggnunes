import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, Search, ArrowUpRight, ArrowDownLeft, Phone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppLog {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  phone_number: string;
  direction: string;
  message_text: string | null;
  message_type: string;
  sent_at: string;
  contact?: { name: string };
  deal?: { name: string };
}

export const CRMWhatsAppLogs = () => {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('crm_whatsapp_logs')
      .select(`
        *,
        contact:crm_contacts(name),
        deal:crm_deals(name)
      `)
      .order('sent_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching WhatsApp logs:', error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  // Group logs by phone number
  const groupedByPhone = logs.reduce((acc, log) => {
    if (!acc[log.phone_number]) {
      acc[log.phone_number] = {
        phone: log.phone_number,
        contactName: log.contact?.name || 'Desconhecido',
        messages: [],
        lastMessage: log.sent_at,
      };
    }
    acc[log.phone_number].messages.push(log);
    return acc;
  }, {} as Record<string, { phone: string; contactName: string; messages: WhatsAppLog[]; lastMessage: string }>);

  const phoneList = Object.values(groupedByPhone)
    .filter(g => 
      searchTerm === '' ||
      g.phone.includes(searchTerm) ||
      g.contactName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime());

  const selectedConversation = selectedPhone ? groupedByPhone[selectedPhone] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Histórico de WhatsApp</h3>
        </div>
        <Badge variant="outline">
          {logs.length} mensagens
        </Badge>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conversa registrada</p>
            <p className="text-sm mt-2">
              As conversas do WhatsApp aparecerão aqui quando sincronizadas com o ChatGuru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Phone list */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por telefone ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {phoneList.map((item) => (
                    <button
                      key={item.phone}
                      onClick={() => setSelectedPhone(item.phone)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                        selectedPhone === item.phone ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.contactName}</p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{item.phone}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.messages.length} mensagens
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.lastMessage), 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card className="lg:col-span-2">
            {selectedConversation ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{selectedConversation.contactName}</CardTitle>
                      <CardDescription>{selectedConversation.phone}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {selectedConversation.messages
                        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
                        .map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                msg.direction === 'outbound'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                {msg.direction === 'outbound' ? (
                                  <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                  <ArrowDownLeft className="h-3 w-3" />
                                )}
                                <span className="text-xs opacity-75">
                                  {msg.direction === 'outbound' ? 'Enviada' : 'Recebida'}
                                </span>
                              </div>
                              {msg.message_type !== 'text' && (
                                <Badge variant="secondary" className="mb-2 text-xs">
                                  {msg.message_type}
                                </Badge>
                              )}
                              <p className="text-sm whitespace-pre-wrap">
                                {msg.message_text || '[Mídia]'}
                              </p>
                              <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/70' : 'text-muted-foreground'}`}>
                                {format(new Date(msg.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <CardContent className="h-[500px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para visualizar</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
