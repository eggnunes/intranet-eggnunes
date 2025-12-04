import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Bot, 
  User, 
  Loader2, 
  X, 
  Image as ImageIcon, 
  Search, 
  Sparkles,
  Globe,
  FileText,
  Trash2,
  Download,
  Copy,
  Check
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; url?: string }[];
  images?: string[];
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  icon: string;
}

const AI_MODELS: AIModel[] = [
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Rápido e eficiente para tarefas gerais',
    capabilities: ['chat', 'analysis', 'code'],
    icon: '✨'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Mais poderoso para raciocínio complexo',
    capabilities: ['chat', 'analysis', 'code', 'reasoning'],
    icon: '🌟'
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    description: 'Modelo mais avançado da OpenAI',
    capabilities: ['chat', 'analysis', 'code', 'reasoning', 'images'],
    icon: '🤖'
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    description: 'Versão rápida e econômica do GPT-5',
    capabilities: ['chat', 'analysis', 'code'],
    icon: '⚡'
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    provider: 'Perplexity',
    description: 'Especializado em pesquisa na internet',
    capabilities: ['chat', 'search', 'research'],
    icon: '🔍'
  },
  {
    id: 'manus',
    name: 'Manus AI',
    provider: 'Manus',
    description: 'Agente autônomo para tarefas complexas',
    capabilities: ['chat', 'agent', 'automation'],
    icon: '🦾'
  }
];

const CAPABILITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  chat: { label: 'Chat', icon: <Bot className="w-3 h-3" /> },
  analysis: { label: 'Análise', icon: <FileText className="w-3 h-3" /> },
  code: { label: 'Código', icon: <Sparkles className="w-3 h-3" /> },
  reasoning: { label: 'Raciocínio', icon: <Sparkles className="w-3 h-3" /> },
  images: { label: 'Imagens', icon: <ImageIcon className="w-3 h-3" /> },
  search: { label: 'Pesquisa', icon: <Search className="w-3 h-3" /> },
  research: { label: 'Pesquisa', icon: <Globe className="w-3 h-3" /> },
  agent: { label: 'Agente', icon: <Bot className="w-3 h-3" /> },
  automation: { label: 'Automação', icon: <Sparkles className="w-3 h-3" /> }
};

const AssistenteIA = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableImageGen, setEnableImageGen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      attachments: attachments.map(f => ({ name: f.name, type: f.type }))
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // Convert attachments to base64 if any
      const attachmentData: { name: string; type: string; content: string }[] = [];
      for (const file of attachments) {
        const base64 = await fileToBase64(file);
        attachmentData.push({
          name: file.name,
          type: file.type,
          content: base64
        });
      }

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel,
          attachments: attachmentData,
          options: {
            enableSearch,
            enableImageGen
          }
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || data.text || 'Desculpe, não consegui processar sua solicitação.',
        timestamp: new Date(),
        images: data.images
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar mensagem',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + attachments.length > 5) {
      toast({
        title: 'Limite de arquivos',
        description: 'Máximo de 5 arquivos por mensagem',
        variant: 'destructive'
      });
      return;
    }
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Send audio for transcription
        try {
          const base64Audio = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(audioBlob);
          });

          const { data, error } = await supabase.functions.invoke('voice-to-text', {
            body: { audio: base64Audio }
          });

          if (error) throw error;

          if (data.text) {
            setInput(prev => prev + (prev ? ' ' : '') + data.text);
          }
        } catch (error: any) {
          console.error('Transcription error:', error);
          toast({
            title: 'Erro na transcrição',
            description: 'Não foi possível transcrever o áudio',
            variant: 'destructive'
          });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível acessar o microfone',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="border-b bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Assistente de IA</h1>
              <p className="text-muted-foreground text-sm">
                Converse com diferentes modelos de IA
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Model Selector */}
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.icon}</span>
                        <span>{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Chat */}
              {messages.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearChat}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Model Info & Capabilities */}
          {currentModel && (
            <div className="max-w-5xl mx-auto mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {currentModel.provider} • {currentModel.description}
                </span>
                <div className="flex flex-wrap gap-1">
                  {currentModel.capabilities.map(cap => (
                    <Badge key={cap} variant="secondary" className="text-xs">
                      {CAPABILITY_LABELS[cap]?.icon}
                      <span className="ml-1">{CAPABILITY_LABELS[cap]?.label}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Model-specific options */}
              <div className="flex flex-wrap gap-2 mt-2">
                {currentModel.capabilities.includes('search') && (
                  <Button
                    variant={enableSearch ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEnableSearch(!enableSearch)}
                    className="h-7 text-xs"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Pesquisa Web
                  </Button>
                )}
                {currentModel.capabilities.includes('images') && (
                  <Button
                    variant={enableImageGen ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEnableImageGen(!enableImageGen)}
                    className="h-7 text-xs"
                  >
                    <ImageIcon className="w-3 h-3 mr-1" />
                    Gerar Imagens
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-5xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="text-6xl mb-4">{currentModel?.icon || '🤖'}</div>
                <h2 className="text-xl font-semibold mb-2">
                  Olá! Como posso ajudar?
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Selecione um modelo de IA e comece a conversar. Você pode anexar arquivos, 
                  usar voz para ditar ou digitar sua mensagem.
                </p>
                
                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {[
                    'Resuma este documento',
                    'Crie um texto profissional',
                    'Analise este contrato',
                    'Ajude com código'
                  ].map(suggestion => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(suggestion)}
                      className="text-sm"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  
                  <Card className={`max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                    <CardContent className="p-3">
                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((att, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              <Paperclip className="w-3 h-3 mr-1" />
                              {att.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </div>

                      {/* Generated Images */}
                      {message.images && message.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {message.images.map((img, i) => (
                            <img 
                              key={i} 
                              src={img} 
                              alt={`Generated ${i + 1}`} 
                              className="rounded-lg w-full"
                            />
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {message.role === 'assistant' && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => copyToClipboard(message.content, message.id)}
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <Card className="bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Pensando...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-5xl mx-auto">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((file, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    <Paperclip className="w-3 h-3 mr-1" />
                    {file.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
              />
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              {/* Voice Input */}
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                title={isRecording ? 'Parar gravação' : 'Gravar voz'}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>

              {/* Text Input */}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="min-h-[44px] max-h-[200px] resize-none flex-1"
                disabled={isLoading}
              />

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2 text-center">
              Pressione Enter para enviar, Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssistenteIA;
