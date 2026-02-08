import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Check, CheckCheck, Clock, Image, FileText, Mic } from 'lucide-react';
import { format } from 'date-fns';
import { MessageInput } from '@/components/whatsapp/MessageInput';

interface Conversation {
  id: string;
  phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
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

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  onSendMessage: (type: 'text' | 'audio' | 'image' | 'document', content: string, mediaUrl?: string, filename?: string) => Promise<any>;
  userId: string;
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
        {/* Media content */}
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

        {/* Text content */}
        {message.content && message.message_type !== 'document' && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {/* Time and status */}
        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export function ChatArea({ conversation, messages, loading, onSendMessage, userId }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = format(new Date(msg.created_at), 'dd/MM/yyyy');
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate text-foreground">
            {conversation.contact_name || formatPhone(conversation.phone)}
          </p>
          <p className="text-xs text-muted-foreground">{formatPhone(conversation.phone)}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-muted/10">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        ) : (
          <div>
            {groupedMessages.map(group => (
              <div key={group.date}>
                <div className="flex justify-center my-3">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                    {group.date}
                  </span>
                </div>
                {group.messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <MessageInput onSendMessage={onSendMessage} conversationPhone={conversation.phone} />
    </div>
  );
}
