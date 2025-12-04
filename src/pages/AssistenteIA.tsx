import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  Copy,
  Check,
  Plus,
  MessageSquare,
  History,
  Download,
  BookTemplate,
  ChevronRight,
  Zap,
  Brain,
  Cpu,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; url?: string }[];
  images?: string[];
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  prompt: string;
  description: string | null;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  icon: string;
  badge?: string;
}

const AI_MODELS: AIModel[] = [
  // Lovable AI (Gemini)
  {
    id: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google (Lovable)',
    description: 'Rápido e eficiente para tarefas gerais',
    capabilities: ['chat', 'analysis', 'code', 'reasoning'],
    icon: '⚡',
    badge: 'Recomendado'
  },
  {
    id: 'gemini-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google (Lovable)',
    description: 'Ultra-rápido para tarefas simples',
    capabilities: ['chat', 'analysis'],
    icon: '💨'
  },
  {
    id: 'gemini-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google (Lovable)',
    description: 'Mais poderoso para raciocínio complexo',
    capabilities: ['chat', 'analysis', 'code', 'reasoning', 'images'],
    icon: '🌟'
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro Preview',
    provider: 'Google (Lovable)',
    description: 'Próxima geração do Gemini Pro',
    capabilities: ['chat', 'analysis', 'code', 'reasoning', 'images'],
    icon: '🚀',
    badge: 'Novo'
  },
  // Lovable AI (GPT via Gateway)
  {
    id: 'lovable-gpt-5',
    name: 'GPT-5 (via Lovable)',
    provider: 'OpenAI (Lovable)',
    description: 'Modelo mais avançado da OpenAI',
    capabilities: ['chat', 'analysis', 'code', 'reasoning', 'images'],
    icon: '🤖'
  },
  {
    id: 'lovable-gpt-5-mini',
    name: 'GPT-5 Mini (via Lovable)',
    provider: 'OpenAI (Lovable)',
    description: 'Versão rápida e econômica do GPT-5',
    capabilities: ['chat', 'analysis', 'code'],
    icon: '⚡'
  },
  {
    id: 'lovable-gpt-5-nano',
    name: 'GPT-5 Nano (via Lovable)',
    provider: 'OpenAI (Lovable)',
    description: 'Ultra-rápido para tarefas simples',
    capabilities: ['chat', 'analysis'],
    icon: '💨'
  },
  // OpenAI Direct
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Modelo multimodal com visão',
    capabilities: ['chat', 'analysis', 'code', 'images'],
    icon: '👁️',
    badge: 'API Key'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Versão rápida do GPT-4o',
    capabilities: ['chat', 'analysis', 'code'],
    icon: '⚡',
    badge: 'API Key'
  },
  {
    id: 'openai-o3',
    name: 'O3 (Reasoning)',
    provider: 'OpenAI',
    description: 'Modelo de raciocínio avançado',
    capabilities: ['chat', 'reasoning', 'code'],
    icon: '🧠',
    badge: 'API Key'
  },
  {
    id: 'openai-o4-mini',
    name: 'O4 Mini (Fast Reasoning)',
    provider: 'OpenAI',
    description: 'Raciocínio rápido e eficiente',
    capabilities: ['chat', 'reasoning', 'code'],
    icon: '⚡',
    badge: 'API Key'
  },
  // Perplexity
  {
    id: 'perplexity-small',
    name: 'Perplexity Small',
    provider: 'Perplexity',
    description: 'Pesquisa rápida na internet',
    capabilities: ['chat', 'search', 'research'],
    icon: '🔍',
    badge: 'API Key'
  },
  {
    id: 'perplexity-large',
    name: 'Perplexity Large',
    provider: 'Perplexity',
    description: 'Pesquisa detalhada na internet',
    capabilities: ['chat', 'search', 'research'],
    icon: '🔎',
    badge: 'API Key'
  },
  {
    id: 'perplexity-huge',
    name: 'Perplexity Huge',
    provider: 'Perplexity',
    description: 'Pesquisa profunda e análise complexa',
    capabilities: ['chat', 'search', 'research', 'reasoning'],
    icon: '🌐',
    badge: 'API Key'
  },
  // Manus
  {
    id: 'manus',
    name: 'Manus AI',
    provider: 'Manus',
    description: 'Agente autônomo para tarefas complexas',
    capabilities: ['chat', 'agent', 'automation'],
    icon: '🦾',
    badge: 'API Key'
  }
];

const CAPABILITY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  chat: { label: 'Chat', icon: <Bot className="w-3 h-3" /> },
  analysis: { label: 'Análise', icon: <FileText className="w-3 h-3" /> },
  code: { label: 'Código', icon: <Cpu className="w-3 h-3" /> },
  reasoning: { label: 'Raciocínio', icon: <Brain className="w-3 h-3" /> },
  images: { label: 'Imagens', icon: <ImageIcon className="w-3 h-3" /> },
  search: { label: 'Pesquisa', icon: <Search className="w-3 h-3" /> },
  research: { label: 'Pesquisa', icon: <Globe className="w-3 h-3" /> },
  agent: { label: 'Agente', icon: <Bot className="w-3 h-3" /> },
  automation: { label: 'Automação', icon: <Zap className="w-3 h-3" /> }
};

const AssistenteIA = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableImageGen, setEnableImageGen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Conversation history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  
  // Templates
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations and templates on mount
  useEffect(() => {
    if (user) {
      loadConversations();
      loadTemplates();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const loadedMessages: Message[] = (data || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
        attachments: m.attachments as any,
        images: m.images as any
      }));
      
      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
      
      // Get conversation model
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedModel(conv.model);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mensagens',
        variant: 'destructive'
      });
    }
  };

  const createNewConversation = async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: 'Nova conversa',
          model: selectedModel
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const saveMessage = async (conversationId: string, message: Message) => {
    try {
      await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          attachments: message.attachments || [],
          images: message.images || []
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    try {
      await supabase
        .from('ai_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, title } : c
      ));
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      
      toast({
        title: 'Conversa excluída',
        description: 'A conversa foi removida com sucesso'
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir conversa',
        variant: 'destructive'
      });
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  // Stream chat function
  const streamChat = useCallback(async (
    messagesToSend: { role: string; content: string }[],
    model: string,
    attachmentData: any[],
    onDelta: (deltaText: string) => void,
    onDone: () => void
  ) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    abortControllerRef.current = new AbortController();

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        messages: messagesToSend,
        model,
        attachments: attachmentData,
        stream: true,
        options: { enableSearch, enableImageGen }
      }),
      signal: abortControllerRef.current.signal
    });

    if (!resp.ok || !resp.body) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao iniciar streaming');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  }, [enableSearch, enableImageGen]);

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
    setIsStreaming(true);

    try {
      // Create conversation if needed
      let convId = currentConversationId;
      if (!convId) {
        convId = await createNewConversation();
        if (!convId) throw new Error('Failed to create conversation');
        await updateConversationTitle(convId, userMessage.content);
      }
      
      // Save user message
      await saveMessage(convId, userMessage);

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

      const messagesToSend = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      let assistantContent = '';

      const updateAssistantMessage = (nextChunk: string) => {
        assistantContent += nextChunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.id === assistantMessageId) {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, {
            id: assistantMessageId,
            role: 'assistant' as const,
            content: assistantContent,
            timestamp: new Date()
          }];
        });
      };

      await streamChat(
        messagesToSend,
        selectedModel,
        attachmentData,
        updateAssistantMessage,
        async () => {
          setIsStreaming(false);
          setIsLoading(false);
          
          // Save assistant message
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date()
          };
          
          await saveMessage(convId!, assistantMessage);
          
          // Update conversation timestamp
          await supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', convId!);
        }
      );
        
    } catch (error: any) {
      console.error('Error sending message:', error);
      setIsStreaming(false);
      setIsLoading(false);
      
      if (error.name === 'AbortError') {
        toast({
          title: 'Cancelado',
          description: 'Resposta cancelada'
        });
      } else {
        toast({
          title: 'Erro',
          description: error.message || 'Erro ao enviar mensagem',
          variant: 'destructive'
        });
      }
    }
  };

  const cancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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

  const applyTemplate = (template: PromptTemplate) => {
    setInput(template.prompt + ' ');
    setShowTemplates(false);
  };

  const exportToTXT = () => {
    if (messages.length === 0) return;
    
    let content = `Conversa - ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}\n`;
    content += `Modelo: ${currentModel?.name || selectedModel}\n`;
    content += '='.repeat(50) + '\n\n';
    
    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'Você' : 'Assistente';
      const time = format(msg.timestamp, "HH:mm", { locale: ptBR });
      content += `[${time}] ${role}:\n${msg.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-ia-${format(new Date(), "yyyy-MM-dd-HHmm")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Exportado!', description: 'Conversa exportada em TXT' });
  };

  const exportToPDF = () => {
    if (messages.length === 0) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Conversa com Assistente de IA', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y);
    y += 5;
    doc.text(`Modelo: ${currentModel?.name || selectedModel}`, margin, y);
    y += 10;
    
    // Separator
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    // Messages
    doc.setFontSize(10);
    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'Você' : 'Assistente';
      const time = format(msg.timestamp, "HH:mm", { locale: ptBR });
      
      // Check if we need a new page
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Role header
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(msg.role === 'user' ? 0 : 59, 130, 246);
      doc.text(`[${time}] ${role}:`, margin, y);
      y += 6;
      
      // Content
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(msg.content, maxWidth);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      });
      y += 5;
    });
    
    doc.save(`conversa-ia-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    toast({ title: 'Exportado!', description: 'Conversa exportada em PDF' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const templateCategories = [...new Set(templates.map(t => t.category))];
  const filteredTemplates = selectedCategory 
    ? templates.filter(t => t.category === selectedCategory)
    : templates;

  // Group models by provider
  const modelsByProvider = AI_MODELS.reduce((acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, AIModel[]>);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] flex">
        {/* Sidebar - Conversation History */}
        {showSidebar && (
          <div className="w-64 border-r bg-card/50 flex flex-col">
            <div className="p-3 border-b">
              <Button onClick={startNewChat} className="w-full" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Conversa
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoadingConversations ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conversa ainda
                  </p>
                ) : (
                  conversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                        currentConversationId === conv.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => loadConversationMessages(conv.id)}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conv.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b bg-card/50 backdrop-blur-sm p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden"
                >
                  <History className="w-4 h-4" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold">Assistente de IA</h1>
                  <p className="text-muted-foreground text-sm">
                    Converse com diferentes modelos de IA
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Templates Button */}
                <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <BookTemplate className="w-4 h-4 mr-1" />
                      Templates
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Templates Jurídicos</DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-4">
                      {/* Categories */}
                      <div className="w-40 border-r pr-4">
                        <p className="text-sm font-medium mb-2">Categorias</p>
                        <div className="space-y-1">
                          <Button
                            variant={selectedCategory === null ? 'secondary' : 'ghost'}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => setSelectedCategory(null)}
                          >
                            Todos
                          </Button>
                          {templateCategories.map(cat => (
                            <Button
                              key={cat}
                              variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => setSelectedCategory(cat)}
                            >
                              {cat}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Templates List */}
                      <ScrollArea className="flex-1 h-[400px]">
                        <div className="space-y-2 pr-4">
                          {filteredTemplates.map(template => (
                            <Card
                              key={template.id}
                              className="cursor-pointer hover:bg-accent transition-colors"
                              onClick={() => applyTemplate(template)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{template.title}</p>
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      {template.category}
                                    </Badge>
                                    {template.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {template.description}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Export Dropdown */}
                {messages.length > 0 && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={exportToTXT}>
                      <Download className="w-4 h-4 mr-1" />
                      TXT
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <FileText className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                )}

                {/* Model Selector */}
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span>{currentModel?.icon}</span>
                        <span className="truncate">{currentModel?.name}</span>
                        {currentModel?.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {currentModel.badge}
                          </Badge>
                        )}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {Object.entries(modelsByProvider).map(([provider, models]) => (
                      <div key={provider}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                          {provider}
                        </div>
                        {models.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              <span>{model.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {model.badge && (
                                    <Badge variant="outline" className="text-xs">
                                      {model.badge}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {model.description}
                                </p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Model Capabilities */}
            {currentModel && (
              <div className="flex flex-wrap gap-1 mt-3">
                {currentModel.capabilities.map(cap => {
                  const capInfo = CAPABILITY_LABELS[cap];
                  if (!capInfo) return null;
                  return (
                    <Badge key={cap} variant="outline" className="text-xs gap-1">
                      {capInfo.icon}
                      {capInfo.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Olá! Como posso ajudar?</h2>
                  <p className="text-muted-foreground mb-6">
                    Selecione um modelo e comece a conversar. Use os templates para começar rapidamente.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {templates.slice(0, 4).map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                      >
                        {template.title}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    
                    <Card className={`max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
                      <CardContent className="p-3">
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                          {isStreaming && message.role === 'assistant' && messages[messages.length - 1].id === message.id && (
                            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                          )}
                        </div>
                        
                        {message.images && message.images.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Generated ${idx + 1}`}
                                className="max-w-[200px] rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                        
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.attachments.map((att, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Paperclip className="w-3 h-3 mr-1" />
                                {att.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                          <span>{format(message.timestamp, "HH:mm", { locale: ptBR })}</span>
                          {message.role === 'assistant' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(message.content, message.id)}
                            >
                              {copiedId === message.id ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-card/50 backdrop-blur-sm p-4">
            <div className="max-w-3xl mx-auto">
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((file, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      <Paperclip className="w-3 h-3" />
                      {file.name}
                      <button onClick={() => removeAttachment(index)}>
                        <X className="w-3 h-3 ml-1" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={isRecording ? 'bg-red-500 text-white hover:bg-red-600' : ''}
                  disabled={isLoading}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 min-h-[44px] max-h-[200px] resize-none"
                  disabled={isLoading}
                />

                {isStreaming ? (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={cancelStreaming}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                ) : (
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
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-2">
                Modelo: {currentModel?.name} • Enter para enviar, Shift+Enter para nova linha
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssistenteIA;
