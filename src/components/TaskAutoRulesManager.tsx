import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, Search, FileText, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TaskAutoRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_value: string;
  task_type_id: number;
  task_title_template: string;
  task_description_template: string | null;
  days_to_deadline: number;
  responsible_user_id: string | null;
  created_at: string;
}

interface TaskType {
  id: number;
  title: string;
}

interface TaskAutoRulesManagerProps {
  taskTypes: TaskType[];
  advboxUsers: { id: string; name: string }[];
}

export function TaskAutoRulesManager({ taskTypes, advboxUsers }: TaskAutoRulesManagerProps) {
  const { user } = useAuth();
  const [rules, setRules] = useState<TaskAutoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaskAutoRule | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    trigger_type: 'keyword' as 'keyword' | 'movement_type' | 'publication_type',
    trigger_value: '',
    task_type_id: 0,
    task_title_template: '',
    task_description_template: '',
    days_to_deadline: 7,
    responsible_user_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('task_auto_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      trigger_type: 'keyword',
      trigger_value: '',
      task_type_id: 0,
      task_title_template: '',
      task_description_template: '',
      days_to_deadline: 7,
      responsible_user_id: '',
      is_active: true
    });
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.trigger_value || !formData.task_type_id || !formData.task_title_template) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('task_auto_rules')
          .update({
            name: formData.name,
            trigger_type: formData.trigger_type,
            trigger_value: formData.trigger_value,
            task_type_id: formData.task_type_id,
            task_title_template: formData.task_title_template,
            task_description_template: formData.task_description_template || null,
            days_to_deadline: formData.days_to_deadline,
            responsible_user_id: formData.responsible_user_id || null,
            is_active: formData.is_active
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Regra atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('task_auto_rules')
          .insert({
            name: formData.name,
            trigger_type: formData.trigger_type,
            trigger_value: formData.trigger_value,
            task_type_id: formData.task_type_id,
            task_title_template: formData.task_title_template,
            task_description_template: formData.task_description_template || null,
            days_to_deadline: formData.days_to_deadline,
            responsible_user_id: formData.responsible_user_id || null,
            is_active: formData.is_active,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success('Regra criada com sucesso');
      }

      setDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Erro ao salvar regra');
    }
  };

  const handleEdit = (rule: TaskAutoRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      trigger_type: rule.trigger_type as 'keyword' | 'movement_type' | 'publication_type',
      trigger_value: rule.trigger_value,
      task_type_id: rule.task_type_id,
      task_title_template: rule.task_title_template,
      task_description_template: rule.task_description_template || '',
      days_to_deadline: rule.days_to_deadline,
      responsible_user_id: rule.responsible_user_id || '',
      is_active: rule.is_active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    try {
      const { error } = await supabase
        .from('task_auto_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Regra excluída');
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erro ao excluir regra');
    }
  };

  const handleToggleActive = async (rule: TaskAutoRule) => {
    try {
      const { error } = await supabase
        .from('task_auto_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(rule.is_active ? 'Regra desativada' : 'Regra ativada');
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Erro ao atualizar regra');
    }
  };

  const getTriggerTypeIcon = (type: string) => {
    switch (type) {
      case 'keyword': return <Search className="h-4 w-4" />;
      case 'movement_type': return <FileText className="h-4 w-4" />;
      case 'publication_type': return <Tag className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case 'keyword': return 'Palavra-chave';
      case 'movement_type': return 'Tipo de Movimentação';
      case 'publication_type': return 'Tipo de Publicação';
      default: return type;
    }
  };

  const getTaskTypeName = (id: number) => {
    return taskTypes.find(t => t.id === id)?.title || `Tipo ${id}`;
  };

  if (loading) {
    return <div className="text-center py-4">Carregando regras...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Regras de Tarefas Automáticas
          </CardTitle>
          <CardDescription>
            Configure regras para criar tarefas automaticamente com base em padrões
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
              <DialogDescription>
                Defina quando uma tarefa deve ser criada automaticamente
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Regra *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Intimação com prazo"
                />
              </div>

              <div>
                <Label htmlFor="trigger_type">Tipo de Gatilho *</Label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value: 'keyword' | 'movement_type' | 'publication_type') => 
                    setFormData({ ...formData, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">Palavra-chave no título</SelectItem>
                    <SelectItem value="movement_type">Tipo de movimentação</SelectItem>
                    <SelectItem value="publication_type">Tipo de publicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="trigger_value">
                  {formData.trigger_type === 'keyword' ? 'Palavra-chave *' : 'Valor do gatilho *'}
                </Label>
                <Input
                  id="trigger_value"
                  value={formData.trigger_value}
                  onChange={(e) => setFormData({ ...formData, trigger_value: e.target.value })}
                  placeholder={formData.trigger_type === 'keyword' 
                    ? "Ex: intimação, prazo, audiência" 
                    : "Ex: Despacho, Sentença"}
                />
                {formData.trigger_type === 'keyword' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Separe múltiplas palavras por vírgula. A busca ignora maiúsculas/minúsculas.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="task_type">Tipo de Tarefa *</Label>
                <Select
                  value={formData.task_type_id?.toString() || ''}
                  onValueChange={(value) => setFormData({ ...formData, task_type_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="task_title_template">Título da Tarefa *</Label>
                <Input
                  id="task_title_template"
                  value={formData.task_title_template}
                  onChange={(e) => setFormData({ ...formData, task_title_template: e.target.value })}
                  placeholder="Ex: Verificar intimação - {processo}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{processo}'} para incluir o número do processo
                </p>
              </div>

              <div>
                <Label htmlFor="task_description_template">Descrição (opcional)</Label>
                <Input
                  id="task_description_template"
                  value={formData.task_description_template}
                  onChange={(e) => setFormData({ ...formData, task_description_template: e.target.value })}
                  placeholder="Descrição adicional da tarefa"
                />
              </div>

              <div>
                <Label htmlFor="days_to_deadline">Prazo (dias)</Label>
                <Input
                  id="days_to_deadline"
                  type="number"
                  min="1"
                  value={formData.days_to_deadline}
                  onChange={(e) => setFormData({ ...formData, days_to_deadline: parseInt(e.target.value) || 7 })}
                />
              </div>

              <div>
                <Label htmlFor="responsible">Responsável (opcional)</Label>
                <Select
                  value={formData.responsible_user_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, responsible_user_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável definido</SelectItem>
                    {advboxUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Regra ativa</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  {editingRule ? 'Salvar' : 'Criar Regra'}
                </Button>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma regra configurada</p>
            <p className="text-sm">Crie regras para automatizar a criação de tarefas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  rule.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{rule.name}</span>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getTriggerTypeIcon(rule.trigger_type)}
                      {getTriggerTypeLabel(rule.trigger_type)}: <strong>{rule.trigger_value}</strong>
                    </span>
                    <span>→ {getTaskTypeName(rule.task_type_id)}</span>
                    <span>{rule.days_to_deadline} dias</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => handleToggleActive(rule)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
