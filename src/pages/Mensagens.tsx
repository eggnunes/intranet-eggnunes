import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useMessaging, Conversation, Message } from '@/hooks/useMessaging';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Send,
  Plus,
  Users,
  User,
  Search,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

const Mensagens = () => {
  const { user } = useAuth();
  const {
    conversations,
    loading,
    activeConversation,
    setActiveConversation,
    messages,
    loadingMessages,
    sendMessage,
    createConversation
  } = useMessaging();

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .neq('id', user?.id || '');

      setAvailableUsers(data || []);
    };

    if (showNewConversation) {
      fetchUsers();
    }
  }, [showNewConversation, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!activeConversation || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(activeConversation.id, newMessage);
      setNewMessage('');
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    setCreatingConversation(true);
    try {
      const isGroup = selectedUsers.length > 1;
      const conv = await createConversation(
        selectedUsers,
        isGroup ? groupName : undefined,
        isGroup
      );

      if (conv) {
        setActiveConversation(conv);
        setShowMobileChat(true);
      }

      setShowNewConversation(false);
      setSelectedUsers([]);
      setGroupName('');
    } finally {
      setCreatingConversation(false);
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group && conv.name) return conv.name;

    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.full_name || 'Conversa';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.avatar_url;
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const filteredUsers = availableUsers.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Mensagens</h1>
          </div>

          <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conversa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Conversa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pessoas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {selectedUsers.length > 1 && (
                  <div>
                    <Label>Nome do Grupo</Label>
                    <Input
                      placeholder="Ex: Equipe Jurídica"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                )}

                <ScrollArea className="h-60">
                  <div className="space-y-2">
                    {filteredUsers.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setSelectedUsers(prev =>
                            prev.includes(u.id)
                              ? prev.filter(id => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      >
                        <Checkbox checked={selectedUsers.includes(u.id)} />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url || ''} />
                          <AvatarFallback>{u.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Button
                  className="w-full"
                  onClick={handleCreateConversation}
                  disabled={selectedUsers.length === 0 || creatingConversation}
                >
                  {creatingConversation ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : selectedUsers.length > 1 ? (
                    <Users className="h-4 w-4 mr-2" />
                  ) : (
                    <User className="h-4 w-4 mr-2" />
                  )}
                  {selectedUsers.length > 1 ? 'Criar Grupo' : 'Iniciar Conversa'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 flex rounded-lg border overflow-hidden bg-card">
          {/* Conversations List */}
          <div className={cn(
            "w-full md:w-80 border-r flex flex-col",
            showMobileChat && "hidden md:flex"
          )}>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversas..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-3 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma conversa</p>
                  <p className="text-xs">Comece uma nova conversa!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setActiveConversation(conv);
                        setShowMobileChat(true);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        activeConversation?.id === conv.id
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        {conv.is_group ? (
                          <AvatarFallback className="bg-primary/20">
                            <Users className="h-5 w-5" />
                          </AvatarFallback>
                        ) : (
                          <>
                            <AvatarImage src={getConversationAvatar(conv) || ''} />
                            <AvatarFallback>
                              {getConversationName(conv)[0]}
                            </AvatarFallback>
                          </>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">
                            {getConversationName(conv)}
                          </p>
                          {conv.last_message && (
                            <span className="text-xs text-muted-foreground">
                              {formatMessageDate(conv.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.last_message?.content || 'Nenhuma mensagem'}
                          </p>
                          {conv.unread_count && conv.unread_count > 0 && (
                            <Badge variant="default" className="ml-2 h-5 min-w-[20px] justify-center">
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

          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col",
            !showMobileChat && "hidden md:flex"
          )}>
            {activeConversation ? (
              <>
                {/* Header */}
                <div className="h-14 border-b flex items-center gap-3 px-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setShowMobileChat(false)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    {activeConversation.is_group ? (
                      <AvatarFallback className="bg-primary/20">
                        <Users className="h-4 w-4" />
                      </AvatarFallback>
                    ) : (
                      <>
                        <AvatarImage src={getConversationAvatar(activeConversation) || ''} />
                        <AvatarFallback>
                          {getConversationName(activeConversation)[0]}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {getConversationName(activeConversation)}
                    </p>
                    {activeConversation.is_group && (
                      <p className="text-xs text-muted-foreground">
                        {activeConversation.participants?.length} participantes
                      </p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>Nenhuma mensagem ainda. Diga olá!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, i) => {
                        const isMe = msg.sender_id === user?.id;
                        const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id;

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2",
                              isMe ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isMe && showAvatar && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.sender?.avatar_url || ''} />
                                <AvatarFallback>
                                  {msg.sender?.full_name?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {!isMe && !showAvatar && <div className="w-8" />}
                            <div
                              className={cn(
                                "max-w-[70%] rounded-lg px-3 py-2",
                                isMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              {!isMe && showAvatar && activeConversation.is_group && (
                                <p className="text-xs font-medium mb-1 opacity-70">
                                  {msg.sender?.full_name}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <p className={cn(
                                "text-[10px] mt-1",
                                isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Selecione uma conversa</p>
                  <p className="text-sm">ou inicie uma nova</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Mensagens;
