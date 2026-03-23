import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarIcon, Upload, Brain, Save, CheckCircle, XCircle, AlertTriangle, FileText, X, ChevronsUpDown, Check, Mic, Square, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { maskCPF, maskPhone } from '@/lib/masks';
import { ClientImportSearch } from '@/components/viabilidade/ClientImportSearch';
import { AddressFields, buildAddressString, type AddressData } from '@/components/viabilidade/AddressFields';

const defaultTipos = ['Cível', 'Trabalhista', 'Previdenciário', 'Tributário'];

const recomendacaoConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  viavel: { label: 'Viável', icon: CheckCircle, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  inviavel: { label: 'Inviável', icon: XCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  necessita_mais_dados: { label: 'Necessita Mais Dados', icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
};

const emptyAddress: AddressData = { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' };

export default function ViabilidadeNovo() {
  const navigate = useNavigate();

  // Form
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState<Date>();
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<AddressData>(emptyAddress);
  const [tipoAcao, setTipoAcao] = useState('');
  const [tipoAcaoOpen, setTipoAcaoOpen] = useState(false);
  const [tiposAcaoOptions, setTiposAcaoOptions] = useState<{ label: string; source: string }[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [descricaoCaso, setDescricaoCaso] = useState('');
  const [modeloIA, setModeloIA] = useState<'claude' | 'chatgpt'>('claude');
  const [arquivos, setArquivos] = useState<File[]>([]);

  // Fetch dynamic action types
  useEffect(() => {
    const fetchTipos = async () => {
      setLoadingTipos(true);
      try {
        const [contractsRes, dealsRes, leadsRes] = await Promise.all([
          supabase.from('contract_drafts').select('product_name'),
          supabase.from('crm_deals').select('product_name'),
          supabase.from('captured_leads').select('product_name'),
        ]);

        const seen = new Set<string>();
        const options: { label: string; source: string }[] = [];

        const addItems = (items: any[] | null, source: string) => {
          items?.forEach((item: any) => {
            const name = item.product_name?.trim();
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              options.push({ label: name, source });
            }
          });
        };

        addItems(contractsRes.data, 'ADVBox');
        addItems(dealsRes.data, 'CRM');
        addItems(leadsRes.data, 'Leads');

        // Add defaults that aren't already present
        defaultTipos.forEach(t => {
          if (!seen.has(t.toLowerCase())) {
            seen.add(t.toLowerCase());
            options.push({ label: t, source: 'Padrão' });
          }
        });

        setTiposAcaoOptions(options);
      } catch (err) {
        console.error('Error fetching action types:', err);
        setTiposAcaoOptions(defaultTipos.map(t => ({ label: t, source: 'Padrão' })));
      } finally {
        setLoadingTipos(false);
      }
    };
    fetchTipos();
  }, []);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      toast.error('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.text) {
        setDescricaoCaso(prev => prev ? `${prev}\n${data.text}` : data.text);
        toast.success('Áudio transcrito com sucesso!');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Erro ao transcrever o áudio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parecer, setParecer] = useState('');
  const [recomendacao, setRecomendacao] = useState('');
  const [saving, setSaving] = useState(false);

  const handleImportClient = (data: { nome: string; cpf: string; telefone: string; email: string; cidade?: string; estado?: string }) => {
    if (data.nome) setNome(data.nome);
    if (data.cpf) setCpf(maskCPF(data.cpf));
    if (data.telefone) setTelefone(maskPhone(data.telefone));
    if (data.email) setEmail(data.email);
    if (data.cidade || data.estado) {
      setAddress(prev => ({
        ...prev,
        cidade: data.cidade || prev.cidade,
        estado: data.estado || prev.estado,
      }));
    }
    toast.success('Dados do cliente importados!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArquivos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setArquivos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!nome.trim() || !tipoAcao || !descricaoCaso.trim()) {
      toast.error('Preencha Nome, Tipo de Ação e Descrição do Caso para analisar.');
      return;
    }

    setAnalyzing(true);
    setProgress(10);
    setParecer('');
    setRecomendacao('');

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 8, 90));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-viability', {
        body: {
          nome,
          cpf,
          tipo_acao: tipoAcao,
          descricao_caso: descricaoCaso,
          data_nascimento: dataNascimento ? format(dataNascimento, 'dd/MM/yyyy') : null,
          telefone,
          email,
          endereco: buildAddressString(address),
          modelo: modeloIA,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setParecer(data.parecer);
      setRecomendacao(data.recomendacao);
      toast.success('Análise concluída!');
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      toast.error('Erro ao realizar análise de viabilidade.');
    } finally {
      setAnalyzing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleSave = async () => {
    if (!nome.trim() || !cpf.trim()) {
      toast.error('Nome e CPF são obrigatórios para salvar.');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); return; }

      const docPaths: string[] = [];
      for (const file of arquivos) {
        const filePath = `viabilidade/${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          docPaths.push(filePath);
        }
      }

      let status = 'pendente';
      if (recomendacao === 'viavel') status = 'revisado';
      else if (recomendacao === 'inviavel') status = 'revisado';
      else if (recomendacao === 'necessita_mais_dados') status = 'em_analise';

      const enderecoStr = buildAddressString(address);

      const { error } = await supabase.from('viabilidade_clientes').insert({
        nome,
        cpf,
        data_nascimento: dataNascimento ? format(dataNascimento, 'yyyy-MM-dd') : null,
        telefone: telefone || null,
        email: email || null,
        endereco: enderecoStr || null,
        tipo_acao: tipoAcao || null,
        descricao_caso: descricaoCaso || null,
        documentos: docPaths,
        parecer_viabilidade: parecer || null,
        analise_realizada_em: parecer ? new Date().toISOString() : null,
        status,
        created_by: user.id,
      } as any);

      if (error) throw error;

      toast.success('Cliente salvo com sucesso!');
      navigate('/viabilidade');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const recCfg = recomendacaoConfig[recomendacao] || null;

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/viabilidade')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Cliente — Viabilidade</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados e analise a viabilidade do caso</p>
          </div>
        </div>

        {/* Import Client */}
        <ClientImportSearch onSelect={handleImportClient} />

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataNascimento && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataNascimento ? format(dataNascimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataNascimento}
                      onSelect={setDataNascimento}
                      disabled={date => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div>
                <Label>Tipo de Ação *</Label>
                <Popover open={tipoAcaoOpen} onOpenChange={setTipoAcaoOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={tipoAcaoOpen} className="w-full justify-between font-normal">
                      {tipoAcao || 'Selecione o tipo de ação...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar tipo de ação..." />
                      <CommandList>
                        <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                        {['ADVBox', 'CRM', 'Leads', 'Padrão'].map(source => {
                          const items = tiposAcaoOptions.filter(o => o.source === source);
                          if (items.length === 0) return null;
                          return (
                            <CommandGroup key={source} heading={source}>
                              {items.map(opt => (
                                <CommandItem
                                  key={opt.label}
                                  value={opt.label}
                                  onSelect={(val) => {
                                    setTipoAcao(val);
                                    setTipoAcaoOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", tipoAcao === opt.label ? "opacity-100" : "opacity-0")} />
                                  {opt.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Address Fields */}
            <AddressFields address={address} onChange={setAddress} />

            <div>
              <Label>Descrição do Caso *</Label>
              <Textarea
                value={descricaoCaso}
                onChange={e => setDescricaoCaso(e.target.value)}
                placeholder="Descreva detalhadamente o caso do cliente..."
                rows={5}
              />
            </div>

            {/* Upload */}
            <div>
              <Label>Documentos</Label>
              <div className="mt-1">
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-input rounded-md p-4 hover:bg-accent/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para adicionar documentos</span>
                  <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                </label>
              </div>
              {arquivos.length > 0 && (
                <div className="mt-2 space-y-1">
                  {arquivos.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Model Selector + Analyze Button */}
        <Card>
          <CardContent className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">Escolha o modelo de IA para análise</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setModeloIA('claude')}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all",
                    modeloIA === 'claude'
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-muted-foreground/50"
                  )}
                >
                  <span className="font-semibold text-sm text-foreground">Claude — Análise Profunda</span>
                  <span className="text-xs text-muted-foreground">Anthropic Claude Sonnet 4. Excelente em raciocínio jurídico estruturado e fundamentação legal detalhada.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModeloIA('chatgpt')}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-all",
                    modeloIA === 'chatgpt'
                      ? "border-primary bg-primary/5"
                      : "border-input hover:border-muted-foreground/50"
                  )}
                >
                  <span className="font-semibold text-sm text-foreground">ChatGPT — Pesquisa Investigativa</span>
                  <span className="text-xs text-muted-foreground">OpenAI o3 com raciocínio avançado. Ideal para investigação aprofundada e análise de cenários complexos.</span>
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <Button size="lg" onClick={handleAnalyze} disabled={analyzing} className="gap-2">
                <Brain className="h-5 w-5" />
                {analyzing ? 'Analisando...' : 'Analisar Viabilidade'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {analyzing && (
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary animate-pulse" />
                <p className="text-sm font-medium text-foreground">Analisando viabilidade do caso...</p>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {parecer && !analyzing && (
          <Card className="border-2 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Parecer de Viabilidade</CardTitle>
              {recCfg && (
                <Badge className={`gap-1 ${recCfg.className}`}>
                  <recCfg.icon className="h-3.5 w-3.5" />
                  {recCfg.label}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                {parecer}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/viabilidade')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
