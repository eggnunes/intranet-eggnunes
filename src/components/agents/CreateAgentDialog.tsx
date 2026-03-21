import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Sparkles, Upload, X, Link2, Loader2, FileText, Image as ImageIcon, Globe } from 'lucide-react';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingAgent?: any;
}

const EMOJI_OPTIONS = ['🤖', '⚖️', '📝', '📊', '🔍', '💼', '📋', '🏛️', '🧠', '💡', '📑', '🎯', '🔬', '📚'];

export function CreateAgentDialog({ open, onOpenChange, onSuccess, editingAgent }: CreateAgentDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(editingAgent?.name || '');
  const [objective, setObjective] = useState(editingAgent?.objective || '');
  const [instructions, setInstructions] = useState(editingAgent?.instructions || '');
  const [iconEmoji, setIconEmoji] = useState(editingAgent?.icon_emoji || '🤖');
  const [files, setFiles] = useState<{ name: string; type: string; file?: File; url?: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [suggestingInstructions, setSuggestingInstructions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectingModel, setSelectingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState(editingAgent?.model || '');
  const [modelJustification, setModelJustification] = useState('');
  const [suggestInput, setSuggestInput] = useState('');

  const resetForm = () => {
    if (!editingAgent) {
      setName(''); setObjective(''); setInstructions(''); setIconEmoji('🤖');
      setFiles([]); setSelectedModel(''); setModelJustification(''); setSuggestInput('');
    }
  };

  const suggestInstructions = async () => {
    if (!name && !objective) {
      toast.error('Preencha o nome e objetivo do agente primeiro');
      return;
    }
    setSuggestingInstructions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-agent-instructions', {
        body: { name, objective, userInput: suggestInput || undefined }
      });
      if (error) throw error;
      if (data?.instructions) {
        setInstructions(data.instructions);
        toast.success('Instruções sugeridas com sucesso!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao sugerir instruções');
    }
    setSuggestingInstructions(false);
  };

  const selectModel = async () => {
    if (!instructions) {
      toast.error('Preencha as instruções primeiro');
      return;
    }
    setSelectingModel(true);
    try {
      const { data, error } = await supabase.functions.invoke('select-agent-model', {
        body: { instructions }
      });
      if (error) throw error;
      if (data?.model) {
        setSelectedModel(data.model);
        setModelJustification(data.justification || '');
        toast.success(`Modelo selecionado: ${data.model}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao selecionar modelo');
    }
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

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
      case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case 'link': return <Globe className="h-4 w-4 text-green-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleSave = async () => {
    if (!name || !objective || !instructions) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (!user) return;
    setSaving(true);

    try {
      // Auto-select model if not selected
      let model = selectedModel;
      if (!model) {
        const { data } = await supabase.functions.invoke('select-agent-model', { body: { instructions } });
        model = data?.model || 'google/gemini-3-flash-preview';
      }

      if (editingAgent) {
        const { error } = await supabase
          .from('intranet_agents')
          .update({ name, objective, instructions, model, icon_emoji: iconEmoji })
          .eq('id', editingAgent.id);
        if (error) throw error;
        toast.success('Agente atualizado!');
      } else {
        const { data: agentData, error } = await supabase
          .from('intranet_agents')
          .insert({ name, objective, instructions, model, icon_emoji: iconEmoji, created_by: user.id })
          .select()
          .single();
        if (error) throw error;

        // Upload files
        for (const file of files) {
          if (file.type === 'link') {
            await supabase.from('intranet_agent_files').insert({
              agent_id: agentData.id,
              file_name: file.name,
              file_type: 'link',
              file_url: file.url!,
            });
          } else if (file.file) {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${agentData.id}/${Date.now()}_${sanitizedName}`;
            const { error: uploadError } = await supabase.storage
              .from('agent-files')
              .upload(filePath, file.file);
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('agent-files').getPublicUrl(filePath);
              await supabase.from('intranet_agent_files').insert({
                agent_id: agentData.id,
                file_name: file.name,
                file_type: file.type,
                file_url: urlData.publicUrl,
                file_size: file.file.size,
              });
            }
          }
        }
        toast.success('Agente criado com sucesso!');
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar agente');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Emoji selector */}
          <div>
            <Label>Ícone do Agente</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIconEmoji(emoji)}
                  className={`text-2xl p-2 rounded-lg border-2 transition-all ${iconEmoji === emoji ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="agent-name">Nome do Agente *</Label>
            <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gerador de Petições Trabalhistas" />
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedModel}</Badge>
                </div>
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
                <Upload className="h-3.5 w-3.5" />
                Upload Arquivo
              </Button>
              <div className="flex gap-2 flex-1">
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Adicionar link..." className="text-sm" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                <Button variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}>
                      <X className="h-3 w-3" />
                    </Button>
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
