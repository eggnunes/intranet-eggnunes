import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Sparkles, Upload, X, Link2, Loader2, FileText, Image as ImageIcon, Globe, Database, Shield } from 'lucide-react';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingAgent?: any;
}

const EMOJI_OPTIONS = ['🤖', '⚖️', '📝', '📊', '🔍', '💼', '📋', '🏛️', '🧠', '💡', '📑', '🎯', '🔬', '📚'];

const COLOR_OPTIONS = [
  { value: 'purple', label: 'Roxo', class: 'bg-purple-500' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { value: 'red', label: 'Vermelho', class: 'bg-red-500' },
  { value: 'yellow', label: 'Amarelo', class: 'bg-yellow-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
];

const DATA_ACCESS_OPTIONS = [
  { value: 'leads', label: 'Leads / CRM', description: 'Contatos, deals e pipeline do CRM' },
  { value: 'colaboradores', label: 'Colaboradores', description: 'Dados dos colaboradores do escritório' },
  { value: 'intimacoes', label: 'Intimações / Publicações', description: 'Publicações do DJE e intimações' },
  { value: 'financeiro', label: 'Financeiro', description: 'Lançamentos, contas e contratos financeiros' },
  { value: 'campanhas', label: 'Campanhas', description: 'Campanhas de marketing do CRM' },
  { value: 'tarefas', label: 'Tarefas', description: 'Tarefas pendentes e em andamento' },
  { value: 'processos', label: 'Processos', description: 'Dados de processos do Advbox' },
];

export function CreateAgentDialog({ open, onOpenChange, onSuccess, editingAgent }: CreateAgentDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [functionRole, setFunctionRole] = useState('');
  const [objective, setObjective] = useState('');
  const [instructions, setInstructions] = useState('');
  const [iconEmoji, setIconEmoji] = useState('🤖');
  const [cardColor, setCardColor] = useState('purple');
  const [isActive, setIsActive] = useState(true);
  const [dataAccess, setDataAccess] = useState<string[]>([]);
  const [files, setFiles] = useState<{ name: string; type: string; file?: File; url?: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [suggestingInstructions, setSuggestingInstructions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectingModel, setSelectingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelJustification, setModelJustification] = useState('');
  const [suggestInput, setSuggestInput] = useState('');

  useEffect(() => {
    if (editingAgent) {
      setName(editingAgent.name || '');
      setFunctionRole(editingAgent.function_role || '');
      setObjective(editingAgent.objective || '');
      setInstructions(editingAgent.instructions || '');
      setIconEmoji(editingAgent.icon_emoji || '🤖');
      setCardColor(editingAgent.card_color || 'purple');
      setIsActive(editingAgent.is_active !== false);
      setDataAccess(editingAgent.data_access || []);
      setSelectedModel(editingAgent.model || '');
    } else {
      resetForm();
    }
  }, [editingAgent, open]);

  const resetForm = () => {
    setName(''); setFunctionRole(''); setObjective(''); setInstructions(''); setIconEmoji('🤖');
    setCardColor('purple'); setIsActive(true); setDataAccess([]);
    setFiles([]); setSelectedModel(''); setModelJustification(''); setSuggestInput('');
  };

  const toggleDataAccess = (value: string) => {
    if (value === 'all') {
      if (dataAccess.includes('all')) {
        setDataAccess([]);
      } else {
        setDataAccess(['all', ...DATA_ACCESS_OPTIONS.map(o => o.value)]);
      }
      return;
    }
    setDataAccess(prev => {
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
      // Remove 'all' if not all selected
      if (next.filter(v => v !== 'all').length < DATA_ACCESS_OPTIONS.length) {
        return next.filter(v => v !== 'all');
      }
      return next;
    });
  };

  const suggestInstructions = async () => {
    if (!name && !objective) { toast.error('Preencha o nome e objetivo do agente primeiro'); return; }
    setSuggestingInstructions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-agent-instructions', {
        body: { name, objective, userInput: suggestInput || undefined }
      });
      if (error) throw error;
      if (data?.instructions) { setInstructions(data.instructions); toast.success('Instruções sugeridas com sucesso!'); }
    } catch (e) { console.error(e); toast.error('Erro ao sugerir instruções'); }
    setSuggestingInstructions(false);
  };

  const selectModel = async () => {
    if (!instructions) { toast.error('Preencha as instruções primeiro'); return; }
    setSelectingModel(true);
    try {
      const { data, error } = await supabase.functions.invoke('select-agent-model', { body: { instructions } });
      if (error) throw error;
      if (data?.model) { setSelectedModel(data.model); setModelJustification(data.justification || ''); toast.success(`Modelo selecionado: ${data.model}`); }
    } catch (e) { console.error(e); toast.error('Erro ao selecionar modelo'); }
    setSelectingModel(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    const newFiles = Array.from(selectedFiles).map(f => ({
      name: f.name,
      type: f.type.includes('pdf') ? 'pdf' : f.type.includes('image') ? 'image' : 'document',
      file: f
    }));
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    setFiles(prev => [...prev, { name: linkUrl, type: 'link', url: linkUrl }]);
    setLinkUrl('');
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
      case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case 'link': return <Globe className="h-4 w-4 text-green-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleSave = async () => {
    if (!name || !objective || !instructions) { toast.error('Preencha todos os campos obrigatórios'); return; }
    if (!user) return;
    setSaving(true);

    try {
      let model = selectedModel;
      if (!model) {
        const { data } = await supabase.functions.invoke('select-agent-model', { body: { instructions } });
        model = data?.model || 'google/gemini-3-flash-preview';
      }

      const agentPayload = {
        name, objective, instructions, model, icon_emoji: iconEmoji,
        function_role: functionRole || null,
        card_color: cardColor,
        is_active: isActive,
        data_access: dataAccess.filter(v => v !== ''),
      };

      if (editingAgent) {
        const { error } = await supabase
          .from('intranet_agents')
          .update(agentPayload)
          .eq('id', editingAgent.id);
        if (error) throw error;
        toast.success('Agente atualizado!');
      } else {
        const { data: agentData, error } = await supabase
          .from('intranet_agents')
          .insert({ ...agentPayload, created_by: user.id })
          .select()
          .single();
        if (error) throw error;

        for (const file of files) {
          if (file.type === 'link') {
            await supabase.from('intranet_agent_files').insert({
              agent_id: agentData.id, file_name: file.name, file_type: 'link', file_url: file.url!,
            });
          } else if (file.file) {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${agentData.id}/${Date.now()}_${sanitizedName}`;
            const { error: uploadError } = await supabase.storage.from('agent-files').upload(filePath, file.file);
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('agent-files').getPublicUrl(filePath);
              await supabase.from('intranet_agent_files').insert({
                agent_id: agentData.id, file_name: file.name, file_type: file.type, file_url: urlData.publicUrl, file_size: file.file.size,
              });
            }
          }
        }
        toast.success('Agente criado com sucesso!');
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (e) { console.error(e); toast.error('Erro ao salvar agente'); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Emoji + Color + Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ícone e Aparência</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="agent-active" className="text-sm text-muted-foreground">Status:</Label>
                <Switch id="agent-active" checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setIconEmoji(emoji)}
                  className={`text-2xl p-2 rounded-lg border-2 transition-all ${iconEmoji === emoji ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted'}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Cor do Card</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button key={color.value} type="button" onClick={() => setCardColor(color.value)}
                    className={`w-8 h-8 rounded-full ${color.class} transition-all ${cardColor === color.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'}`}
                    title={color.label} />
                ))}
              </div>
            </div>
          </div>

          {/* Name + Function (2 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agent-name">Nome do Agente *</Label>
              <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gerador de Petições" />
            </div>
            <div>
              <Label htmlFor="agent-function">Função / Especialidade</Label>
              <Input id="agent-function" value={functionRole} onChange={(e) => setFunctionRole(e.target.value)} placeholder="Ex: Especialista em Direito Trabalhista" />
            </div>
          </div>

          {/* Objective */}
          <div>
            <Label htmlFor="agent-objective">Objetivo *</Label>
            <Textarea id="agent-objective" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Descreva o que este agente deve fazer..." rows={2} />
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="agent-instructions">Instruções *</Label>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={suggestInstructions} disabled={suggestingInstructions}>
                {suggestingInstructions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Sugerir com IA
              </Button>
            </div>
            <div className="mb-2">
              <Input value={suggestInput} onChange={(e) => setSuggestInput(e.target.value)} placeholder="Descreva o que deseja para a IA sugerir instruções (opcional)..." className="text-sm" />
            </div>
            <Textarea id="agent-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instruções detalhadas para o agente..." rows={8} className="font-mono text-sm" />
          </div>

          {/* Data Access */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-primary" />
              <Label>Acesso a Dados do Sistema</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Selecione quais dados do sistema este agente pode consultar e analisar.</p>
            
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              {/* All access toggle */}
              <div className="flex items-center gap-3 pb-3 border-b">
                <Checkbox id="data-all" checked={dataAccess.includes('all')} onCheckedChange={() => toggleDataAccess('all')} />
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <label htmlFor="data-all" className="text-sm font-semibold cursor-pointer">Acesso Total ao Sistema</label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DATA_ACCESS_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-start gap-3">
                    <Checkbox id={`data-${option.value}`} checked={dataAccess.includes(option.value)} onCheckedChange={() => toggleDataAccess(option.value)} />
                    <div>
                      <label htmlFor={`data-${option.value}`} className="text-sm font-medium cursor-pointer">{option.label}</label>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Modelo de IA</Label>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={selectModel} disabled={selectingModel}>
                {selectingModel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Selecionar Automaticamente
              </Button>
            </div>
            {selectedModel && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2"><Badge variant="outline">{selectedModel}</Badge></div>
                {modelJustification && <p className="text-sm text-muted-foreground mt-1">{modelJustification}</p>}
              </div>
            )}
            {!selectedModel && <p className="text-sm text-muted-foreground">O modelo será selecionado automaticamente ao salvar.</p>}
          </div>

          {/* Files */}
          <div>
            <Label>Base de Conhecimento (opcional)</Label>
            <p className="text-sm text-muted-foreground mb-2">Adicione documentos PDF, imagens ou links como referência para o agente.</p>
            <div className="flex gap-2 mb-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload Arquivo
              </Button>
              <div className="flex gap-2 flex-1">
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Adicionar link..." className="text-sm" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                <Button variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}><Link2 className="h-3.5 w-3.5" /></Button>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" onChange={handleFileUpload} />
            </div>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                    {getFileIcon(file.type)}
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <Badge variant="outline" className="text-xs">{file.type}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name || !objective || !instructions}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingAgent ? 'Salvar Alterações' : 'Criar Agente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
