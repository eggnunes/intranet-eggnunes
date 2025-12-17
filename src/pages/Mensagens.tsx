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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Loader2,
  Mic,
  MicOff,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    createConversation,
    deleteConversation,
    editMessage
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [isSocio, setIsSocio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is socio
  useEffect(() => {
    const checkSocio = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('position, email')
        .eq('id', user.id)
        .single();
      
      setIsSocio(data?.position === 'socio' || data?.email === 'rafael@eggnunes.com.br');
    };
    checkSocio();
  }, [user]);

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

  const handleDeleteConversation = async () => {
    if (!deleteConversationId) return;
    await deleteConversation(deleteConversationId);
    setDeleteConversationId(null);
  };

  const canEditMessage = (msg: Message) => {
    if (msg.sender_id !== user?.id) return false;
    const minutesSinceSent = differenceInMinutes(new Date(), new Date(msg.created_at));
    return minutesSinceSent <= 5;
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    
    const success = await editMessage(editingMessageId, editingContent);
    if (success) {
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      audioChunksRef.current = [];
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!activeConversation) return;

    try {
      setSending(true);
      
      // Upload audio to storage
      const fileName = `audio_${Date.now()}.webm`;
      const filePath = `${user?.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      // Send message with audio link
      await sendMessage(activeConversation.id, `🎤 Mensagem de voz: ${publicUrl}`);
      toast.success('Áudio enviado');
    } catch (error) {
      console.error('Error sending audio:', error);
      toast.error('Erro ao enviar áudio');
    } finally {
      setSending(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                <DialogDescription>
                  Selecione os participantes para iniciar uma conversa
                </DialogDescription>
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
                    <div key={conv.id} className="relative group">
                      <button
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
                      
                      {/* Delete button for sócios */}
                      {isSocio && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConversationId(conv.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
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
                <div className="h-14 border-b flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
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
                  
                  {isSocio && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConversationId(activeConversation.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Conversa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
                        const isEditing = editingMessageId === msg.id;

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2 group",
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
                            
                            <div className="flex items-start gap-1">
                              {isMe && canEditMessage(msg) && !isEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleStartEdit(msg)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              
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
                                
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingContent}
                                      onChange={(e) => setEditingContent(e.target.value)}
                                      className="min-h-[60px] text-sm bg-background text-foreground"
                                      autoFocus
                                    />
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleCancelEdit}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={handleSaveEdit}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    <div className={cn(
                                      "flex items-center gap-1 mt-1",
                                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )}>
                                      <span className="text-[10px]">
                                        {format(new Date(msg.created_at), 'HH:mm')}
                                      </span>
                                      {msg.is_edited && (
                                        <span className="text-[10px]">(editado)</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
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
                  {isRecording ? (
                    <div className="flex items-center gap-3 bg-destructive/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
                        <span className="text-sm font-medium">
                          Gravando... {formatRecordingTime(recordingTime)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={cancelRecording}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={stopRecording}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
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
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={startRecording}
                        disabled={sending}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </form>
                  )}
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

      {/* Delete Conversation Dialog */}
      <AlertDialog open={!!deleteConversationId} onOpenChange={() => setDeleteConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita e todas as mensagens serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteConversation}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Mensagens;
