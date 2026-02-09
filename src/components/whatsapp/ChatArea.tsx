import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Check, CheckCheck, Clock, FileText, Mic, Lock, ChevronRight, ChevronDown, Search, X, ArrowDown, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';
import { MessageInput } from '@/components/whatsapp/MessageInput';
import { InternalCommentInput } from '@/components/whatsapp/InternalCommentInput';
import { ContactDetailsPanel } from '@/components/whatsapp/ContactDetailsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface Message {
  id: string;
  conversation_id: string;
  phone: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  status: string;
  is_from_me: boolean;
  created_at: string;
  zapi_message_id: string | null;
  sent_by?: string | null;
  transcription?: string | null;
}

export interface InternalComment {
  id: string;
  conversation_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
  _type: 'comment';
}

type TimelineItem = (Message & { _type: 'message' }) | InternalComment;

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  comments: InternalComment[];
  loading: boolean;
  onSendMessage: (type: 'text' | 'audio' | 'image' | 'document', content: string, mediaUrl?: string, filename?: string) => Promise<any>;
  userId: string;
  onCommentSent: () => void;
  onConversationUpdated: (conv: Partial<Conversation>) => void;
  zapiConnected?: boolean | null;
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

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />;
    default: return null;
  }
}

function highlightMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-blue-600 dark:text-blue-400 font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CommentBubble({ comment }: { comment: InternalComment }) {
  const time = format(new Date(comment.created_at), 'HH:mm');

  return (
    <div className="flex justify-center mb-2">
      <div className="max-w-[80%] rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase">Interno</span>
          <span className="text-[10px] text-muted-foreground">• {comment.author_name}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{highlightMentions(comment.content)}</p>
        <div className="flex justify-end mt-1">
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
      </div>
    </div>
  );
}

function AudioTranscription({ message }: { message: Message }) {
  const [transcription, setTranscription] = useState<string | null>(message.transcription || null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTranscription(message.transcription || null);
  }, [message.transcription]);

  // Auto-transcribe if no transcription exists
  useEffect(() => {
    if (!transcription && message.media_url && !loading) {
      handleTranscribe();
    }
  }, [message.id]);

  const handleTranscribe = async () => {
    if (!message.media_url || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio-url', {
        body: { audioUrl: message.media_url, messageId: message.id },
      });
      if (error) throw error;
      if (data?.text) {
        setTranscription(data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      // Silently fail - don't toast on auto-transcribe
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="mt-1 text-[11px] text-muted-foreground italic flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        Transcrevendo...
      </div>
    );
  }

  if (transcription) {
    return (
      <div className="mt-1 pt-1 border-t border-border/30">
        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
          📝 {transcription}
        </p>
      </div>
    );
  }

  return null;
}

function SenderInfo({ message, senderName }: { message: Message; senderName: string | null }) {
  const isOutbound = message.is_from_me || message.direction === 'outbound';

  if (!senderName && !isOutbound) return null;

  const displayName = isOutbound ? (senderName || 'Escritório') : null;
  if (!displayName) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOutbound ? 'end' : 'start'} className="min-w-[140px]">
        <DropdownMenuItem className="text-xs cursor-default" disabled>
          Enviada por: <span className="font-medium ml-1">{displayName}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MessageBubble({ message, senderName }: { message: Message; senderName: string | null }) {
  const isOutbound = message.is_from_me || message.direction === 'outbound';
  const time = format(new Date(message.created_at), 'HH:mm');

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isOutbound
            ? 'bg-green-100 dark:bg-green-900/30 text-foreground'
            : 'bg-card border text-foreground'
        }`}
      >
        {message.message_type === 'image' && message.media_url && (
          <div className="mb-1">
            <img
              src={message.media_url}
              alt="Imagem"
              className="rounded max-w-full max-h-64 object-cover cursor-pointer"
              onClick={() => window.open(message.media_url!, '_blank')}
            />
          </div>
        )}

        {message.message_type === 'audio' && message.media_url && (
          <div className="mb-1">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <audio controls className="max-w-full h-8" preload="none">
                <source src={message.media_url} type={message.media_mime_type || 'audio/ogg'} />
              </audio>
            </div>
            <AudioTranscription message={message} />
          </div>
        )}

        {message.message_type === 'document' && message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background/50 rounded mb-1 hover:bg-background/80 transition-colors"
          >
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">{message.media_filename || message.content || 'Documento'}</span>
          </a>
        )}

        {message.message_type === 'video' && message.media_url && (
          <div className="mb-1">
            <video controls className="rounded max-w-full max-h-64" preload="none">
              <source src={message.media_url} type={message.media_mime_type || 'video/mp4'} />
            </video>
          </div>
        )}

        {message.content && message.message_type !== 'document' && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
          <SenderInfo message={message} senderName={senderName} />
        </div>
      </div>
    </div>
  );
}

// Global search component
function GlobalSearch({ onSelectConversation }: { onSelectConversation: (convId: string, msgId: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search in messages
      const { data: msgResults } = await supabase
        .from('whatsapp_messages')
        .select('id, conversation_id, content, created_at, phone, direction, message_type, transcription')
        .or(`content.ilike.%${query.trim()}%,transcription.ilike.%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(30);

      // Search in internal comments
      const { data: commentResults } = await supabase
        .from('whatsapp_internal_comments')
        .select('id, conversation_id, content, created_at')
        .ilike('content', `%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get conversation names for the results
      const convIds = [...new Set([
        ...(msgResults || []).map(m => m.conversation_id),
        ...(commentResults || []).map(c => c.conversation_id),
      ])];

      const { data: convData } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_name, phone')
        .in('id', convIds.length > 0 ? convIds : ['none']);

      const convMap: Record<string, any> = {};
      convData?.forEach(c => { convMap[c.id] = c; });

      const combined = [
        ...(msgResults || []).map(m => ({
          ...m,
          _type: 'message' as const,
          convName: convMap[m.conversation_id]?.contact_name || convMap[m.conversation_id]?.phone || '',
        })),
        ...(commentResults || []).map(c => ({
          ...c,
          _type: 'comment' as const,
          convName: convMap[c.conversation_id]?.contact_name || convMap[c.conversation_id]?.phone || '',
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setResults(combined.slice(0, 30));
    } catch (err) {
      console.error('Search error:', err);
    }
    setSearching(false);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) handleSearch();
      else setResults([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const highlightQuery = (text: string | null) => {
    if (!text || !query.trim()) return text || '';
    const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 rounded px-0.5">{part}</mark> : part
    );
  };

  if (!open) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)} title="Busca global">
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Input
          autoFocus
          placeholder="Buscar em todas as conversas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-sm border-none shadow-none focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { setOpen(false); setQuery(''); setResults([]); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {searching ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Buscando...</div>
        ) : results.length === 0 && query.trim().length >= 2 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Nenhum resultado encontrado</div>
        ) : query.trim().length < 2 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Digite pelo menos 2 caracteres</div>
        ) : (
          <div>
            {results.map((r, i) => (
              <button
                key={`${r._type}-${r.id}`}
                onClick={() => {
                  onSelectConversation(r.conversation_id, r.id);
                  setOpen(false);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2.5 border-b hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-foreground">{r.convName}</span>
                  {r._type === 'comment' && (
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">Interno</span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(new Date(r.created_at), 'dd/MM/yy HH:mm')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {highlightQuery(r.content || r.transcription || '')}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function ChatArea({ conversation, messages, comments, loading, onSendMessage, userId, onCommentSent, onConversationUpdated, zapiConnected }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, comments]);

  // Fetch sender names for outbound messages
  useEffect(() => {
    const senderIds = [...new Set(
      messages
        .filter(m => m.sent_by && (m.is_from_me || m.direction === 'outbound'))
        .map(m => m.sent_by!)
    )];

    if (senderIds.length === 0) return;

    const fetchNames = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      if (data) {
        const nameMap: Record<string, string> = {};
        data.forEach(p => { nameMap[p.id] = p.full_name || 'Desconhecido'; });
        setSenderNames(prev => ({ ...prev, ...nameMap }));
      }
    };
    fetchNames();
  }, [messages]);

  const handleGlobalSearchSelect = useCallback((convId: string, msgId: string) => {
    // If it's the same conversation, scroll to message
    if (conversation && conversation.id === convId) {
      const el = document.getElementById(`msg-${msgId}`) || document.getElementById(`comment-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary/50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary/50'), 3000);
      }
    }
    // Otherwise, parent should switch conversation - this requires passing a callback
  }, [conversation]);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/20">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium">WhatsApp Avisos</h3>
          <p className="text-sm mt-1">Selecione uma conversa ou inicie uma nova</p>
        </div>
      </div>
    );
  }

  // Build unified timeline
  const timeline: TimelineItem[] = [
    ...messages.map(m => ({ ...m, _type: 'message' as const })),
    ...comments,
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Group by date
  const groupedTimeline: { date: string; items: TimelineItem[] }[] = [];
  timeline.forEach(item => {
    const date = format(new Date(item.created_at), 'dd/MM/yyyy');
    const lastGroup = groupedTimeline[groupedTimeline.length - 1];
    if (lastGroup && lastGroup.date === date) {
      lastGroup.items.push(item);
    } else {
      groupedTimeline.push({ date, items: [item] });
    }
  });

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Header - clickable */}
        <div className="px-4 py-3 border-b bg-card flex items-center gap-3 w-full">
          <button
            onClick={() => setShowDetails(true)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              zapiConnected === false ? 'bg-red-500/20' : 'bg-green-500/20'
            }`}>
              <MessageCircle className={`h-5 w-5 ${
                zapiConnected === false ? 'text-red-600' : 'text-green-600'
              }`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate text-foreground">
                {conversation.contact_name || formatPhone(conversation.phone)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPhone(conversation.phone)}
                {zapiConnected === false && (
                  <span className="ml-1.5 text-red-500">• Desconectada</span>
                )}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
          <GlobalSearch onSelectConversation={handleGlobalSearchSelect} />
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 bg-muted/10">
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Carregando mensagens...</div>
          ) : timeline.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Nenhuma mensagem ainda. Envie a primeira!
            </div>
          ) : (
            <div>
              {groupedTimeline.map(group => (
                <div key={group.date}>
                  <div className="flex justify-center my-3">
                    <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                      {group.date}
                    </span>
                  </div>
                  {group.items.map(item =>
                    item._type === 'comment' ? (
                      <div key={`c-${item.id}`} id={`comment-${item.id}`} className="transition-all duration-300">
                        <CommentBubble comment={item} />
                      </div>
                    ) : (
                      <div key={`m-${item.id}`} id={`msg-${item.id}`} className="transition-all duration-300">
                        <MessageBubble
                          message={item}
                          senderName={item.sent_by ? senderNames[item.sent_by] || null : null}
                        />
                      </div>
                    )
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        {showCommentInput ? (
          <InternalCommentInput
            conversationId={conversation.id}
            onCommentSent={() => { onCommentSent(); setShowCommentInput(false); }}
            onCancel={() => setShowCommentInput(false)}
          />
        ) : (
          <MessageInput
            onSendMessage={onSendMessage}
            conversationPhone={conversation.phone}
            onToggleComment={() => setShowCommentInput(true)}
          />
        )}
      </div>

      {/* Details Panel */}
      {showDetails && (
        <ContactDetailsPanel
          conversationId={conversation.id}
          contactName={conversation.contact_name}
          phone={conversation.phone}
          sector={conversation.sector || null}
          onClose={() => setShowDetails(false)}
          onNameUpdated={(name) => onConversationUpdated({ contact_name: name })}
          onSectorUpdated={(sector) => onConversationUpdated({ sector })}
        />
      )}
    </div>
  );
}
