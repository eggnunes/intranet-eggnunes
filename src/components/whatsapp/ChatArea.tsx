import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Check, CheckCheck, Clock, FileText, Mic, Lock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { MessageInput } from '@/components/whatsapp/MessageInput';
import { InternalCommentInput } from '@/components/whatsapp/InternalCommentInput';
import { ContactDetailsPanel } from '@/components/whatsapp/ContactDetailsPanel';
import { Button } from '@/components/ui/button';

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

function MessageBubble({ message }: { message: Message }) {
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
          <div className="mb-1 flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <audio controls className="max-w-full h-8" preload="none">
              <source src={message.media_url} type={message.media_mime_type || 'audio/ogg'} />
            </audio>
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
        </div>
      </div>
    </div>
  );
}

export function ChatArea({ conversation, messages, comments, loading, onSendMessage, userId, onCommentSent, onConversationUpdated }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, comments]);

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
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header - clickable */}
        <button
          onClick={() => setShowDetails(true)}
          className="px-4 py-3 border-b bg-card flex items-center gap-3 w-full text-left hover:bg-accent/30 transition-colors"
        >
          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate text-foreground">
              {conversation.contact_name || formatPhone(conversation.phone)}
            </p>
            <p className="text-xs text-muted-foreground">{formatPhone(conversation.phone)}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>

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
                      <CommentBubble key={`c-${item.id}`} comment={item} />
                    ) : (
                      <MessageBubble key={`m-${item.id}`} message={item} />
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
