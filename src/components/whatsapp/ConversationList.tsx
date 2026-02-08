import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onNewConversation: (phone: string, contactName?: string) => void;
  loading: boolean;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM/yy');
}

function formatPhone(phone: string): string {
  if (phone.startsWith('55') && phone.length >= 12) {
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    if (number.length === 9) {
      return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }
    return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }
  return phone;
}

export function ConversationList({ conversations, selectedId, onSelect, onNewConversation, loading }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = conversations.filter(c => {
    const term = search.toLowerCase();
    return (c.contact_name?.toLowerCase().includes(term) || false)
      || c.phone.includes(term)
      || (c.last_message_text?.toLowerCase().includes(term) || false);
  });

  const handleNewConversation = () => {
    if (!newPhone.trim()) return;
    onNewConversation(newPhone.trim(), newName.trim() || undefined);
    setNewPhone('');
    setNewName('');
    setDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Conversas</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conversa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input
                    placeholder="(31) 99999-9999"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Contato</Label>
                  <Input
                    placeholder="Nome (opcional)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <Button onClick={handleNewConversation} className="w-full">
                  Iniciar Conversa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          <div>
            {filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full text-left px-3 py-3 border-b transition-colors hover:bg-accent/50 ${
                  selectedId === conv.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate text-foreground">
                      {conv.contact_name || formatPhone(conv.phone)}
                    </p>
                    {conv.contact_name && (
                      <p className="text-xs text-muted-foreground">{formatPhone(conv.phone)}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_text || 'Sem mensagens'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(conv.last_message_at)}
                    </span>
                    {conv.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px] bg-green-500 hover:bg-green-500">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
