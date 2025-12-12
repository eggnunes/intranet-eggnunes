import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Star, Zap, Edit2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

interface ScoringRule {
  id: string;
  name: string;
  description: string | null;
  field_name: string;
  field_value: string;
  operator: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

const FIELD_OPTIONS = [
  { value: 'utm_source', label: 'UTM Source' },
  { value: 'utm_medium', label: 'UTM Medium' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
  { value: 'traffic_source', label: 'Fonte de Tráfego' },
  { value: 'traffic_medium', label: 'Mídia de Tráfego' },
  { value: 'product_name', label: 'Produto' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'company', label: 'Empresa' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_equals', label: 'Diferente de' },
];

export const CRMLeadScoring = () => {
  const { user } = useAuth();
  const { profile } = useUserRole();
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    field_name: 'utm_source',
    field_value: '',
    operator: 'equals',
    points: 10,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const isSocio = profile?.position === 'socio' || profile?.email === 'rafael@eggnunes.com.br';

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from('crm_lead_scoring_rules')
      .select('*')
      .order('points', { ascending: false });

    if (error) {
      console.error('Error fetching scoring rules:', error);
    } else {
      setRules(data || []);
    }
    setLoading(false);
  };

  const openNewRule = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      field_name: 'utm_source',
      field_value: '',
      operator: 'equals',
      points: 10,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditRule = (rule: ScoringRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      field_name: rule.field_name,
      field_value: rule.field_value,
      operator: rule.operator,
      points: rule.points,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    if (!user || !formData.name || !formData.field_value) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingRule) {
        const { error } = await supabase
          .from('crm_lead_scoring_rules')
          .update({
            name: formData.name,
            description: formData.description || null,
            field_name: formData.field_name,
            field_value: formData.field_value,
            operator: formData.operator,
            points: formData.points,
            is_active: formData.is_active,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Regra atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('crm_lead_scoring_rules')
          .insert({
            name: formData.name,
            description: formData.description || null,
            field_name: formData.field_name,
            field_value: formData.field_value,
            operator: formData.operator,
            points: formData.points,
            is_active: formData.is_active,
            created_by: user.id,
          });

        if (error) throw error;
        toast.success('Regra criada com sucesso');
      }

      setDialogOpen(false);
      fetchRules();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      toast.error('Erro ao salvar regra: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    const { error } = await supabase
      .from('crm_lead_scoring_rules')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir regra');
    } else {
      toast.success('Regra excluída');
      fetchRules();
    }
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('crm_lead_scoring_rules')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
    }
  };

  const applyScoring = async () => {
    if (!confirm('Isso irá recalcular o score de todos os contatos. Continuar?')) return;

    toast.loading('Calculando scores...');

    try {
      // Fetch all contacts
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('*');

      if (!contacts) {
        toast.dismiss();
        toast.error('Erro ao buscar contatos');
        return;
      }

      const activeRules = rules.filter(r => r.is_active);

      for (const contact of contacts) {
        let score = 0;

        for (const rule of activeRules) {
          const fieldValue = (contact as any)[rule.field_name];
          if (!fieldValue) continue;

          let matches = false;
          switch (rule.operator) {
            case 'equals':
              matches = fieldValue.toLowerCase() === rule.field_value.toLowerCase();
              break;
            case 'contains':
              matches = fieldValue.toLowerCase().includes(rule.field_value.toLowerCase());
              break;
            case 'not_equals':
              matches = fieldValue.toLowerCase() !== rule.field_value.toLowerCase();
              break;
          }

          if (matches) {
            score += rule.points;
          }
        }

        // Update contact score
        await supabase
          .from('crm_contacts')
          .update({ lead_score: score })
          .eq('id', contact.id);
      }

      toast.dismiss();
      toast.success(`Scores atualizados para ${contacts.length} contatos`);
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao aplicar scoring');
      console.error('Error applying scoring:', error);
    }
  };

  const getFieldLabel = (field: string) => {
    return FIELD_OPTIONS.find(f => f.value === field)?.label || field;
  };

  const getOperatorLabel = (op: string) => {
    return OPERATOR_OPTIONS.find(o => o.value === op)?.label || op;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Sistema de Lead Scoring</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={applyScoring}>
            <Zap className="h-4 w-4 mr-1" />
            Recalcular Scores
          </Button>
          {isSocio && (
            <Button onClick={openNewRule}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Regra
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Configure regras de pontuação para classificar leads automaticamente.
            Leads com maior pontuação são considerados mais qualificados.
          </p>
        </CardContent>
      </Card>

      {/* Rules List */}
      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma regra de scoring configurada</p>
              {isSocio && (
                <Button variant="outline" className="mt-4" onClick={openNewRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Primeira Regra
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{rule.name}</h4>
                      <Badge 
                        variant={rule.points > 0 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {rule.points > 0 ? '+' : ''}{rule.points} pontos
                      </Badge>
                      {!rule.is_active && (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{getFieldLabel(rule.field_name)}</Badge>
                      <span className="text-muted-foreground">{getOperatorLabel(rule.operator)}</span>
                      <Badge variant="secondary">{rule.field_value}</Badge>
                    </div>
                  </div>
                  {isSocio && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule.id, rule.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditRule(rule)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Scoring'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Regra *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Lead do Google Ads"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ex: Leads vindos de campanhas do Google"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campo</Label>
                <Select
                  value={formData.field_name}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, field_name: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Operador</Label>
                <Select
                  value={formData.operator}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, operator: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                value={formData.field_value}
                onChange={(e) => setFormData(prev => ({ ...prev, field_value: e.target.value }))}
                placeholder="Ex: google, facebook, instagram"
              />
            </div>

            <div className="space-y-2">
              <Label>Pontos</Label>
              <Input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Use valores negativos para penalizar leads
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Regra Ativa</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
