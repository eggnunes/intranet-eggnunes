import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Zap, ListFilter, History, Play, Pause, Trash2, Eye, Users, Edit, Download, Flame, Thermometer, Snowflake, UserX, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────
interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
  executions_count: number;
  last_executed_at: string | null;
  created_at: string;
}

interface LeadList {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, any>;
  created_at: string;
  _matchCount?: number;
}

interface AutomationLog {
  id: string;
  rule_id: string;
  trigger_entity_type: string | null;
  trigger_entity_id: string | null;
  action_result: Record<string, any> | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface Pipeline {
  id: string;
  name: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Lead criado',
  deal_stage_changed: 'Deal movido para etapa',
  score_reached: 'Score atingiu valor',
  deal_won: 'Deal ganho',
  deal_lost: 'Deal perdido',
};

const ACTION_LABELS: Record<string, string> = {
  send_whatsapp: 'Enviar WhatsApp',
  create_task: 'Criar tarefa',
  change_status: 'Mudar status',
  notify_owner: 'Notificar responsável',
};

const ESTADOS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

// ─── Sub-components ──────────────────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('lead_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actionType, setActionType] = useState('notify_owner');
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});

  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from('crm_automation_rules')
      .select('*')
      .order('created_at', { ascending: false });
    setRules((data as any[]) || []);
    setLoading(false);
  }, []);

  const fetchPipelines = useCallback(async () => {
    const { data } = await supabase
      .from('crm_pipelines')
      .select('id, name');
    setPipelines((data as any[]) || []);
  }, []);

  useEffect(() => { fetchRules(); fetchPipelines(); }, [fetchRules, fetchPipelines]);

  const resetForm = () => {
    setName(''); setTriggerType('lead_created'); setTriggerConfig({});
    setActionType('notify_owner'); setActionConfig({}); setEditingRule(null);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerType(rule.trigger_type);
    setTriggerConfig(rule.trigger_config || {});
    setActionType(rule.action_type);
    setActionConfig(rule.action_config || {});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome da regra'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name, trigger_type: triggerType, trigger_config: triggerConfig,
      action_type: actionType, action_config: actionConfig,
      created_by: user.id,
    };

    if (editingRule) {
      await supabase.from('crm_automation_rules').update(payload).eq('id', editingRule.id);
      toast.success('Regra atualizada');
    } else {
      await supabase.from('crm_automation_rules').insert(payload);
      toast.success('Regra criada');
    }
    setDialogOpen(false); resetForm(); fetchRules();
  };

  const toggleActive = async (rule: AutomationRule) => {
    await supabase.from('crm_automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('crm_automation_rules').delete().eq('id', id);
    toast.success('Regra excluída'); fetchRules();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Regras de Automação</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Automação'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Notificar ao ganhar deal" />
              </div>

              {/* Trigger */}
              <div>
                <Label>Gatilho</Label>
                <Select value={triggerType} onValueChange={v => { setTriggerType(v); setTriggerConfig({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {triggerType === 'deal_stage_changed' && (
                <div>
                  <Label>Pipeline / Etapa</Label>
                  <Select value={triggerConfig.stage_id || ''} onValueChange={v => setTriggerConfig({ ...triggerConfig, stage_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {triggerType === 'score_reached' && (
                <div>
                  <Label>Score mínimo</Label>
                  <Input type="number" value={triggerConfig.min_score || ''} onChange={e => setTriggerConfig({ ...triggerConfig, min_score: Number(e.target.value) })} />
                </div>
              )}

              {/* Action */}
              <div>
                <Label>Ação</Label>
                <Select value={actionType} onValueChange={v => { setActionType(v); setActionConfig({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {actionType === 'send_whatsapp' && (
                <div>
                  <Label>Template da mensagem</Label>
                  <Textarea value={actionConfig.message_template || ''} onChange={e => setActionConfig({ ...actionConfig, message_template: e.target.value })} placeholder="Use {{nome}} para o nome do contato" />
                </div>
              )}

              {actionType === 'create_task' && (
                <div className="space-y-2">
                  <div>
                    <Label>Título da tarefa</Label>
                    <Input value={actionConfig.task_title || ''} onChange={e => setActionConfig({ ...actionConfig, task_title: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={actionConfig.task_type || 'follow_up'} onValueChange={v => setActionConfig({ ...actionConfig, task_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Ligação</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">{editingRule ? 'Salvar Alterações' : 'Criar Regra'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma regra criada ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rule.name}</span>
                    <Badge variant="outline">{TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}</Badge>
                    <Badge variant="secondary">{ACTION_LABELS[rule.action_type] || rule.action_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rule.executions_count} execuções
                    {rule.last_executed_at && ` · Última: ${new Date(rule.last_executed_at).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadListsTab() {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewLeads, setPreviewLeads] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<any[]>([]);

  // Form
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterDaysAgo, setFilterDaysAgo] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterUtmSource, setFilterUtmSource] = useState('');

  const fetchLists = useCallback(async () => {
    const { data } = await supabase
      .from('crm_lead_lists')
      .select('*')
      .order('created_at', { ascending: false });
    const items = (data as any[]) || [];
    // Get match counts
    const enriched = await Promise.all(items.map(async (list) => {
      const count = await countMatching(list.filters);
      return { ...list, _matchCount: count };
    }));
    setLists(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const buildQuery = (filters: Record<string, any>) => {
    let q = supabase.from('crm_contacts').select('id, name, email, phone, company, state, city, score, created_at', { count: 'exact' });
    if (filters.state) q = q.eq('state', filters.state);
    if (filters.city) q = q.ilike('city', `%${filters.city}%`);
    if (filters.company) q = q.ilike('company', `%${filters.company}%`);
    if (filters.min_score) q = q.gte('score', Number(filters.min_score));
    if (filters.days_ago) {
      const d = new Date(); d.setDate(d.getDate() - Number(filters.days_ago));
      q = q.gte('created_at', d.toISOString());
    }
    return q;
  };

  const countMatching = async (filters: Record<string, any>) => {
    const { count } = await buildQuery(filters).limit(0);
    return count || 0;
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    const filters: Record<string, any> = {};
    if (filterState) filters.state = filterState;
    if (filterCity) filters.city = filterCity;
    if (filterDaysAgo) filters.days_ago = filterDaysAgo;
    if (filterMinScore) filters.min_score = filterMinScore;
    if (filterCompany) filters.company = filterCompany;
    if (filterUtmSource) filters.utm_source = filterUtmSource;

    const { data } = await buildQuery(filters).limit(20);
    setPreviewLeads(data || []);
    setPreviewLoading(false);
  };

  const handleSave = async () => {
    if (!listName.trim()) { toast.error('Informe o nome da lista'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const filters: Record<string, any> = {};
    if (filterState) filters.state = filterState;
    if (filterCity) filters.city = filterCity;
    if (filterDaysAgo) filters.days_ago = filterDaysAgo;
    if (filterMinScore) filters.min_score = filterMinScore;
    if (filterCompany) filters.company = filterCompany;
    if (filterUtmSource) filters.utm_source = filterUtmSource;

    await supabase.from('crm_lead_lists').insert({ name: listName, description: listDesc || null, filters, created_by: user.id });
    toast.success('Lista criada');
    setDialogOpen(false);
    setListName(''); setListDesc(''); setFilterState(''); setFilterCity('');
    setFilterDaysAgo(''); setFilterMinScore(''); setFilterCompany(''); setFilterUtmSource('');
    setPreviewLeads([]);
    fetchLists();
  };

  const handleExpand = async (list: LeadList) => {
    if (expandedId === list.id) { setExpandedId(null); return; }
    setExpandedId(list.id);
    const { data } = await buildQuery(list.filters).limit(50);
    setExpandedLeads(data || []);
  };

  const deleteList = async (id: string) => {
    await supabase.from('crm_lead_lists').delete().eq('id', id);
    toast.success('Lista excluída'); fetchLists();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Listas Dinâmicas de Leads</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Lista</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Lista Dinâmica</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={listName} onChange={e => setListName(e.target.value)} /></div>
              <div><Label>Descrição</Label><Textarea value={listDesc} onChange={e => setListDesc(e.target.value)} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estado</Label>
                  <Select value={filterState} onValueChange={setFilterState}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>{ESTADOS_BR.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Cidade</Label><Input value={filterCity} onChange={e => setFilterCity(e.target.value)} placeholder="Ex: Belo Horizonte" /></div>
                <div><Label>Últimos X dias</Label><Input type="number" value={filterDaysAgo} onChange={e => setFilterDaysAgo(e.target.value)} placeholder="30" /></div>
                <div><Label>Score mínimo</Label><Input type="number" value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} /></div>
                <div><Label>Empresa</Label><Input value={filterCompany} onChange={e => setFilterCompany(e.target.value)} /></div>
                <div><Label>UTM Source</Label><Input value={filterUtmSource} onChange={e => setFilterUtmSource(e.target.value)} /></div>
              </div>

              <Button variant="outline" onClick={handlePreview} disabled={previewLoading} className="w-full">
                {previewLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
                Preview ({previewLeads.length} leads)
              </Button>

              {previewLeads.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Empresa</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewLeads.map(l => (
                        <TableRow key={l.id}><TableCell className="text-sm">{l.name}</TableCell><TableCell className="text-sm">{l.email}</TableCell><TableCell className="text-sm">{l.company}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">Salvar Lista</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma lista criada ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {lists.map(list => (
            <div key={list.id}>
              <Card>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{list.name}</span>
                    {list.description && <p className="text-xs text-muted-foreground">{list.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{list._matchCount ?? '?'} leads</Badge>
                      {Object.entries(list.filters).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-xs">{k}: {String(v)}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleExpand(list)}>
                      <Eye className="h-4 w-4 mr-1" /> {expandedId === list.id ? 'Fechar' : 'Ver Leads'}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteList(list.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
              {expandedId === list.id && expandedLeads.length > 0 && (
                <div className="ml-4 mt-1 border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead><TableHead>Empresa</TableHead><TableHead>UF</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {expandedLeads.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">{l.name}</TableCell>
                          <TableCell className="text-sm">{l.email}</TableCell>
                          <TableCell className="text-sm">{l.phone}</TableCell>
                          <TableCell className="text-sm">{l.company}</TableCell>
                          <TableCell className="text-sm">{l.state}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogTab() {
  const [logs, setLogs] = useState<(AutomationLog & { rule_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<{ id: string; name: string }[]>([]);
  const [filterRuleId, setFilterRuleId] = useState('all');

  useEffect(() => {
    (async () => {
      const [{ data: logsData }, { data: rulesData }] = await Promise.all([
        supabase.from('crm_automation_log').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('crm_automation_rules').select('id, name'),
      ]);
      const rMap = new Map((rulesData as any[] || []).map(r => [r.id, r.name]));
      setRules((rulesData as any[]) || []);
      setLogs(((logsData as any[]) || []).map(l => ({ ...l, rule_name: rMap.get(l.rule_id) || 'Regra removida' })));
      setLoading(false);
    })();
  }, []);

  const filtered = filterRuleId === 'all' ? logs : logs.filter(l => l.rule_id === filterRuleId);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Log de Execuções</h3>
        <Select value={filterRuleId} onValueChange={setFilterRuleId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as regras" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regras</SelectItem>
            {rules.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma execução registrada.</CardContent></Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-sm">{log.rule_name}</TableCell>
                  <TableCell className="text-sm">{log.trigger_entity_type || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? 'default' : 'destructive'}>
                      {log.success ? 'Sucesso' : 'Erro'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {log.error_message || (log.action_result ? JSON.stringify(log.action_result).slice(0, 60) : '-')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export const MarketingAutomation = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="h-5 w-5" /> Automação e Segmentação</h2>
        <p className="text-sm text-muted-foreground">Crie regras de automação e listas dinâmicas de leads</p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Regras</TabsTrigger>
          <TabsTrigger value="lists" className="flex items-center gap-1"><ListFilter className="h-3.5 w-3.5" /> Listas</TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1"><History className="h-3.5 w-3.5" /> Log</TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="mt-4"><RulesTab /></TabsContent>
        <TabsContent value="lists" className="mt-4"><LeadListsTab /></TabsContent>
        <TabsContent value="log" className="mt-4"><LogTab /></TabsContent>
      </Tabs>
    </div>
  );
};
