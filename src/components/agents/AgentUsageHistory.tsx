import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Eye, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  agent_id: string;
  user_id: string;
  agent_name: string;
  agent_emoji: string;
  user_name: string;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export function AgentUsageHistory() {
  const { isAdmin } = useUserRole();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [filterAgent, setFilterAgent] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load agents for filter
    const { data: agentsData } = await supabase
      .from('intranet_agents')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setAgents(agentsData || []);

    // Load all conversations with agent and user info
    const { data: convData } = await supabase
      .from('intranet_agent_conversations')
      .select('id, title, created_at, updated_at, agent_id, user_id')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!convData || convData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get unique agent and user IDs
    const agentIds = [...new Set(convData.map(c => c.agent_id))];
    const userIds = [...new Set(convData.map(c => c.user_id))];

    const [agentRes, profileRes] = await Promise.all([
      supabase.from('intranet_agents').select('id, name, icon_emoji').in('id', agentIds),
      supabase.from('profiles').select('id, full_name').in('id', userIds),
    ]);

    const agentMap = new Map((agentRes.data || []).map(a => [a.id, a]));
    const profileMap = new Map((profileRes.data || []).map(p => [p.id, p]));

    const enriched: ConversationRow[] = convData.map(c => ({
      ...c,
      agent_name: agentMap.get(c.agent_id)?.name || 'Agente removido',
      agent_emoji: agentMap.get(c.agent_id)?.icon_emoji || '🤖',
      user_name: profileMap.get(c.user_id)?.full_name || 'Usuário desconhecido',
    }));

    setConversations(enriched);
    setLoading(false);
  };

  const viewConversation = async (conv: ConversationRow) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    const { data } = await supabase
      .from('intranet_agent_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from('intranet_agent_conversations')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erro ao excluir conversa');
    } else {
      toast.success('Conversa excluída');
      setConversations(prev => prev.filter(c => c.id !== id));
      if (selectedConversation?.id === id) setSelectedConversation(null);
    }
  };

  const filtered = filterAgent === 'all'
    ? conversations
    : conversations.filter(c => c.agent_id === filterAgent);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Histórico de Uso dos Agentes
            </CardTitle>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa encontrada.</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(conv => (
                    <TableRow key={conv.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span>{conv.agent_emoji}</span>
                          <span className="text-sm">{conv.agent_name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{conv.user_name}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{conv.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(conv.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewConversation(conv)} title="Visualizar">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteConversation(conv.id)} title="Excluir">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation viewer dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={(open) => !open && setSelectedConversation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span>{selectedConversation?.agent_emoji}</span>
              {selectedConversation?.agent_name} — {selectedConversation?.user_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <p className="text-[10px] mt-1 opacity-60">
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
