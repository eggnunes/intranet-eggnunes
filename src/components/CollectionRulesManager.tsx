import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CollectionRule {
  id: string;
  name: string;
  days_overdue: number;
  is_active: boolean;
  send_time: string;
  created_at: string;
}

export function CollectionRulesManager() {
  const { user } = useAuth();
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CollectionRule | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    days_overdue: 7,
    send_time: '09:00',
    is_active: true,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_rules')
        .select('*')
        .order('days_overdue', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingRule) {
        // Atualizar regra existente
        const { error } = await supabase
          .from('collection_rules')
          .update({
            name: formData.name,
            days_overdue: formData.days_overdue,
            send_time: formData.send_time,
            is_active: formData.is_active,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Regra atualizada com sucesso');
      } else {
        // Criar nova regra
        const { error } = await supabase
          .from('collection_rules')
          .insert({
            name: formData.name,
            days_overdue: formData.days_overdue,
            send_time: formData.send_time,
            is_active: formData.is_active,
            created_by: user?.id,
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

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    try {
      const { error } = await supabase
        .from('collection_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Regra excluída com sucesso');
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erro ao excluir regra');
    }
  };

  const handleToggleActive = async (rule: CollectionRule) => {
    try {
      const { error } = await supabase
        .from('collection_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(`Regra ${!rule.is_active ? 'ativada' : 'desativada'}`);
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Erro ao atualizar regra');
    }
  };

  const openEditDialog = (rule: CollectionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      days_overdue: rule.days_overdue,
      send_time: rule.send_time,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      days_overdue: 7,
      send_time: '09:00',
      is_active: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Regras de Cobrança Automática</CardTitle>
            <CardDescription>
              Configure quando as mensagens de cobrança devem ser enviadas automaticamente
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? 'Editar Regra' : 'Nova Regra de Cobrança'}
                </DialogTitle>
                <DialogDescription>
                  Defina quando as mensagens automáticas devem ser enviadas
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Regra</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Primeira cobrança"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="days_overdue">Dias em Atraso</Label>
                  <Input
                    id="days_overdue"
                    type="number"
                    min="1"
                    value={formData.days_overdue}
                    onChange={(e) => setFormData({ ...formData, days_overdue: parseInt(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Mensagem será enviada quando o pagamento estiver X dias atrasado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="send_time">Horário de Envio</Label>
                  <Input
                    id="send_time"
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Regra ativa</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingRule ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma regra configurada</p>
            <p className="text-sm">Crie sua primeira regra para automatizar as cobranças</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Enviar após {rule.days_overdue} dias de atraso</p>
                        <p className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          Horário: {rule.send_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(rule)}
                      >
                        <Switch checked={rule.is_active} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}