import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarIcon, Upload, Brain, Save, CheckCircle, XCircle, AlertTriangle, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { maskCPF, maskPhone } from '@/lib/masks';

const tiposAcao = [
  { value: 'civel', label: 'Cível' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'tributario', label: 'Tributário' },
];

const recomendacaoConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  viavel: { label: 'Viável', icon: CheckCircle, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  inviavel: { label: 'Inviável', icon: XCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  necessita_mais_dados: { label: 'Necessita Mais Dados', icon: AlertTriangle, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
};

export default function ViabilidadeNovo() {
  const navigate = useNavigate();

  // Form
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState<Date>();
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [tipoAcao, setTipoAcao] = useState('');
  const [descricaoCaso, setDescricaoCaso] = useState('');
  const [modeloIA, setModeloIA] = useState<'claude' | 'chatgpt'>('claude');
  const [arquivos, setArquivos] = useState<File[]>([]);

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parecer, setParecer] = useState('');
  const [recomendacao, setRecomendacao] = useState('');
  const [saving, setSaving] = useState(false);

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
          tipo_acao: tiposAcao.find(t => t.value === tipoAcao)?.label || tipoAcao,
          descricao_caso: descricaoCaso,
          data_nascimento: dataNascimento ? format(dataNascimento, 'dd/MM/yyyy') : null,
          telefone,
          email,
          endereco,
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

      // Upload documents
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

      // Determine status based on recommendation
      let status = 'pendente';
      if (recomendacao === 'viavel') status = 'revisado';
      else if (recomendacao === 'inviavel') status = 'revisado';
      else if (recomendacao === 'necessita_mais_dados') status = 'em_analise';

      const { error } = await supabase.from('viabilidade_clientes').insert({
        nome,
        cpf,
        data_nascimento: dataNascimento ? format(dataNascimento, 'yyyy-MM-dd') : null,
        telefone: telefone || null,
        email: email || null,
        endereco: endereco || null,
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
                <Select value={tipoAcao} onValueChange={setTipoAcao}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {tiposAcao.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Endereço</Label>
              <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo" />
            </div>

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

        {/* Analyze Button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={handleAnalyze} disabled={analyzing} className="gap-2">
            <Brain className="h-5 w-5" />
            {analyzing ? 'Analisando...' : 'Analisar Viabilidade'}
          </Button>
        </div>

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
