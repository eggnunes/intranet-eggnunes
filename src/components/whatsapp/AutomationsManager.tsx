import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Bot, Plus, Pencil, Trash2, Sparkles, Eye, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface AutomationRule {
  id: string;
  name: string;
  type: string;
  message_template: string;
  is_active: boolean;
  send_via: string;
  interval_seconds: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  birthday: 'Aniversário',
  boleto: 'Cobrança de Boleto',
  custom: 'Personalizada',
};

const VARIABLE_EXAMPLES: Record<string, string> = {
  '{nome}': 'João Silva',
  '{primeiro_nome}': 'João',
  '{valor}': 'R$ 500,00',
  '{vencimento}': '15/03/2026',
};

export function AutomationsManager() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('custom');
  const [formTemplate, setFormTemplate] = useState('');
  const [formSendVia, setFormSendVia] = useState('zapi');
  const [formInterval, setFormInterval] = useState(120);

  const fetchRules = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_automation_rules')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setRules(data as AutomationRule[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openNewDialog = () => {
    setEditingRule(null);
    setFormName('');
    setFormType('custom');
    setFormTemplate('');
    setFormSendVia('zapi');
    setFormInterval(120);
    setAiPrompt('');
    setDialogOpen(true);
  };

  const openEditDialog = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormType(rule.type);
    setFormTemplate(rule.message_template);
    setFormSendVia(rule.send_via);
    setFormInterval(rule.interval_seconds);
    setAiPrompt('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTemplate.trim()) {
      toast({ title: 'Preencha nome e template', variant: 'destructive' });
      return;
    }

    const payload = {
      name: formName.trim(),
      type: formType,
      message_template: formTemplate,
      send_via: formSendVia,
      interval_seconds: formInterval,
    };

    if (editingRule) {
      const { error } = await supabase
        .from('whatsapp_automation_rules')
        .update(payload)
        .eq('id', editingRule.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Automação atualizada' });
    } else {
      const { error } = await supabase
        .from('whatsapp_automation_rules')
        .insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });

      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Automação criada' });
    }

    setDialogOpen(false);
    fetchRules();
  };

  const handleToggle = async (rule: AutomationRule, active: boolean) => {
    const { error } = await supabase
      .from('whatsapp_automation_rules')
      .update({ is_active: active })
      .eq('id', rule.id);

    if (error) {
      toast({ title: 'Erro ao alternar', description: error.message, variant: 'destructive' });
      return;
    }

    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: active } : r));
    toast({ title: active ? 'Automação ativada' : 'Automação desativada' });
  };

  const handleDelete = async (rule: AutomationRule) => {
    if (!confirm(`Excluir automação "${rule.name}"?`)) return;

    const { error } = await supabase
      .from('whatsapp_automation_rules')
      .delete()
      .eq('id', rule.id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Automação excluída' });
    fetchRules();
  };

  const handlePreview = (template: string) => {
    let text = template;
    Object.entries(VARIABLE_EXAMPLES).forEach(([key, value]) => {
      text = text.split(key).join(value);
    });
    setPreviewText(text);
    setPreviewOpen(true);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: 'Digite um prompt para gerar a mensagem', variant: 'destructive' });
      return;
    }

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-automation-message', {
        body: { prompt: aiPrompt, type: formType },
      });

      if (error) throw error;
      if (data?.message) {
        setFormTemplate(data.message);
        toast({ title: 'Mensagem gerada com IA!' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao gerar mensagem', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Carregando automações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Central de Automações</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie quais mensagens são enviadas automaticamente pelo WhatsApp de Avisos
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNewDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Automação
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma automação cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-70' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{rule.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[rule.type] || rule.type}
                      </Badge>
                      <Badge variant={rule.send_via === 'zapi' ? 'default' : 'secondary'} className="text-xs">
                        {rule.send_via === 'zapi' ? 'Z-API' : 'ChatGuru'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {rule.message_template.substring(0, 120)}...
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Intervalo: {rule.interval_seconds}s
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(rule.message_template)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rule)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Switch checked={rule.is_active} onCheckedChange={(v) => handleToggle(rule, v)} />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
            <DialogDescription>
              Configure a mensagem que será enviada automaticamente pelo WhatsApp de Avisos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Aniversário de Clientes" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">Aniversário</SelectItem>
                    <SelectItem value="boleto">Cobrança de Boleto</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Canal de Envio</Label>
                <Select value={formSendVia} onValueChange={setFormSendVia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zapi">Z-API (WhatsApp Avisos)</SelectItem>
                    <SelectItem value="chatguru">ChatGuru</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Intervalo entre envios (segundos)</Label>
                <Input type="number" min={30} max={600} value={formInterval} onChange={e => setFormInterval(Number(e.target.value))} />
              </div>
            </div>

            <Separator />

            {/* AI Generation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Gerar mensagem com IA
              </Label>
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Ex: Crie uma mensagem de aniversário amigável e profissional para um escritório de advocacia"
                  className="flex-1"
                />
                <Button onClick={handleGenerateAI} disabled={generatingAI} size="sm" variant="secondary">
                  <Sparkles className="h-4 w-4 mr-1" />
                  {generatingAI ? 'Gerando...' : 'Gerar'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template da Mensagem</Label>
              <Textarea
                value={formTemplate}
                onChange={e => setFormTemplate(e.target.value)}
                placeholder="Olá, {nome}! ..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code>{'{nome}'}</code>, <code>{'{primeiro_nome}'}</code>, <code>{'{valor}'}</code>, <code>{'{vencimento}'}</code>
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={() => handlePreview(formTemplate)}>
              <Eye className="h-4 w-4 mr-2" />
              Pré-visualizar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingRule ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Pré-visualização
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm">
            {previewText}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
