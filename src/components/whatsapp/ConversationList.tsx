import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, MessageCircle, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, isToday, isYesterday } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ConversationFilters, ConversationFilterValues, emptyFilters, getActiveFilterCount } from './ConversationFilters';

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
  sector?: string | null;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ConversationFilterValues>(emptyFilters);

  // Loaded relationships for filtering
  const [convTags, setConvTags] = useState<Record<string, TagItem[]>>({});
  const [convAssignees, setConvAssignees] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchRelationships();
  }, [conversations]);

  const fetchRelationships = async () => {
    if (conversations.length === 0) return;
    const convIds = conversations.map(c => c.id);

    const [tagsRes, assigneesRes, allTagsRes] = await Promise.all([
      supabase.from('whatsapp_conversation_tags').select('conversation_id, tag_id').in('conversation_id', convIds),
      supabase.from('whatsapp_conversation_assignees').select('conversation_id, user_id').in('conversation_id', convIds),
      supabase.from('whatsapp_tags').select('id, name, color'),
    ]);

    const tagMap: Record<string, string> = {};
    allTagsRes.data?.forEach((t: any) => { tagMap[t.id] = t.id; });

    const allTagsById: Record<string, TagItem> = {};
    allTagsRes.data?.forEach((t: any) => { allTagsById[t.id] = t; });

    const convTagMap: Record<string, TagItem[]> = {};
    tagsRes.data?.forEach((ct: any) => {
      if (!convTagMap[ct.conversation_id]) convTagMap[ct.conversation_id] = [];
      if (allTagsById[ct.tag_id]) convTagMap[ct.conversation_id].push(allTagsById[ct.tag_id]);
    });
    setConvTags(convTagMap);

    const convAssigneeMap: Record<string, string[]> = {};
    assigneesRes.data?.forEach((ca: any) => {
      if (!convAssigneeMap[ca.conversation_id]) convAssigneeMap[ca.conversation_id] = [];
      convAssigneeMap[ca.conversation_id].push(ca.user_id);
    });
    setConvAssignees(convAssigneeMap);
  };

  const filtered = conversations.filter(c => {
    // Text search
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      (c.contact_name?.toLowerCase().includes(term) || false) ||
      c.phone.includes(term) ||
      (c.last_message_text?.toLowerCase().includes(term) || false);

    if (!matchesSearch) return false;

    // Sector filter
    if (filters.sectors.length > 0 && !filters.sectors.includes(c.sector || '')) return false;

    // Unread filter
    if (filters.unreadOnly && c.unread_count === 0) return false;

    // Tags filter
    if (filters.tags.length > 0) {
      const tags = convTags[c.id] || [];
      if (!filters.tags.some(tid => tags.some(t => t.id === tid))) return false;
    }

    // Assignees filter
    if (filters.assignees.length > 0) {
      const assignees = convAssignees[c.id] || [];
      if (!filters.assignees.some(uid => assignees.includes(uid))) return false;
    }

    return true;
  });

  const handleNewConversation = () => {
    if (!newPhone.trim()) return;
    onNewConversation(newPhone.trim(), newName.trim() || undefined);
    setNewPhone('');
    setNewName('');
    setDialogOpen(false);
  };

  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Conversas</h3>
          <div className="flex items-center gap-1">
            <Button
              variant={showFilters ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
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
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <ConversationFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          <div>
            {filtered.map(conv => {
              const tags = convTags[conv.id] || [];
              return (
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
                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.slice(0, 3).map(tag => (
                            <span
                              key={tag.id}
                              className="text-[9px] px-1.5 py-0.5 rounded-full border"
                              style={{ borderColor: tag.color, color: tag.color, backgroundColor: tag.color + '15' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
                          )}
                        </div>
                      )}
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
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
