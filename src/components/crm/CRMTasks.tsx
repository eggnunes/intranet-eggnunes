import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  List, CalendarDays, Plus, Phone, Mail, Users, RotateCcw,
  AlertTriangle, Clock, CheckCircle2, ChevronLeft, ChevronRight,
  ArrowUpDown, SortAsc, SortDesc, Trash2, Edit, Check, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isPast, isToday, startOfWeek, endOfWeek, addMonths, subMonths, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Activity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  due_date: string | null;
  completed: boolean | null;
  completed_at: string | null;
  contact_id: string | null;
  deal_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  priority: string | null;
}

interface Contact { id: string; name: string; company: string | null; }
interface Deal { id: string; name: string; }
interface Profile { id: string; full_name: string; }

type SortCol = 'title' | 'type' | 'priority' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

const TASK_TYPES = [
  { value: 'call', label: 'Ligação', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Reunião', icon: Users },
  { value: 'follow_up', label: 'Follow-up', icon: RotateCcw },
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'medium', label: 'Média', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
];

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const getTypeInfo = (type: string) => TASK_TYPES.find(t => t.value === type) || TASK_TYPES[3];
const getPriorityInfo = (p: string) => PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];

export const CRMTasks = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Activity | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterOwner, setFilterOwner] = useState('all');

  // Sorting
  const [sortCol, setSortCol] = useState<SortCol>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Form state
  const [form, setForm] = useState({
    title: '', type: 'call', priority: 'medium', due_date: '',
    description: '', linkType: 'none' as 'none' | 'deal' | 'contact',
    deal_id: '', contact_id: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesRes, contactsRes, dealsRes, profilesRes] = await Promise.all([
        supabase.from('crm_activities').select('*').order('due_date', { ascending: true }),
        supabase.from('crm_contacts').select('id, name, company').order('name'),
        supabase.from('crm_deals').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').eq('approval_status', 'approved'),
      ]);
      setActivities((activitiesRes.data as Activity[]) || []);
      setContacts(contactsRes.data || []);
      setDeals(dealsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Notify when tasks due within 24h on mount
  useEffect(() => {
    if (activities.length === 0) return;
    const now = new Date();
    const dueSoon = activities.filter(a => {
      if (a.completed) return false;
      if (!a.due_date) return false;
      const d = parseISO(a.due_date);
      if (!isValid(d)) return false;
      const diff = d.getTime() - now.getTime();
      return diff > 0 && diff <= 24 * 60 * 60 * 1000;
    });
    if (dueSoon.length > 0) {
      sendNotifications(dueSoon);
    }
  }, [activities]);

  const sendNotifications = async (tasks: Activity[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const t of tasks) {
      await supabase.from('user_notifications').insert({
        user_id: t.owner_id || user.id,
        title: '⏰ Tarefa próxima do vencimento',
        message: `A tarefa "${t.title}" vence em breve.`,
        type: 'crm_task_due',
        action_url: '/crm',
      });
    }
  };

  // Summary
  const summary = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    let overdue = 0, dueToday = 0, completedWeek = 0;
    activities.forEach(a => {
      if (!a.completed && a.due_date) {
        const d = parseISO(a.due_date);
        if (isValid(d)) {
          if (isPast(d) && !isToday(d)) overdue++;
          if (isToday(d)) dueToday++;
        }
      }
      if (a.completed && a.completed_at) {
        const c = parseISO(a.completed_at);
        if (isValid(c) && c >= weekStart && c <= weekEnd) completedWeek++;
      }
    });
    return { overdue, dueToday, completedWeek };
  }, [activities]);

  // Filtered + sorted tasks for list
  const filteredTasks = useMemo(() => {
    let list = activities.filter(a => !a.completed);
    if (filterType !== 'all') list = list.filter(a => a.type === filterType);
    if (filterPriority !== 'all') list = list.filter(a => (a.priority || 'medium') === filterPriority);
    if (filterOwner !== 'all') list = list.filter(a => a.owner_id === filterOwner);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'title') cmp = (a.title || '').localeCompare(b.title || '');
      else if (sortCol === 'type') cmp = (a.type || '').localeCompare(b.type || '');
      else if (sortCol === 'priority') cmp = (priorityOrder[a.priority || 'medium'] ?? 2) - (priorityOrder[b.priority || 'medium'] ?? 2);
      else if (sortCol === 'due_date') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        cmp = da - db;
      } else if (sortCol === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [activities, filterType, filterPriority, filterOwner, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <SortAsc className="h-3 w-3 ml-1" /> : <SortDesc className="h-3 w-3 ml-1" />;
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm({ title: '', type: 'call', priority: 'medium', due_date: '', description: '', linkType: 'none', deal_id: '', contact_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (task: Activity) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      type: task.type,
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.slice(0, 16) : '',
      description: task.description || '',
      linkType: task.deal_id ? 'deal' : task.contact_id ? 'contact' : 'none',
      deal_id: task.deal_id || '',
      contact_id: task.contact_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const payload: any = {
        title: form.title,
        type: form.type,
        priority: form.priority,
        due_date: form.due_date || null,
        description: form.description || null,
        deal_id: form.linkType === 'deal' ? form.deal_id || null : null,
        contact_id: form.linkType === 'contact' ? form.contact_id || null : null,
      };

      if (editingTask) {
        const { error } = await supabase.from('crm_activities').update(payload).eq('id', editingTask.id);
        if (error) throw error;
        toast.success('Tarefa atualizada');
      } else {
        payload.owner_id = user.id;
        payload.created_by = user.id;
        const { error } = await supabase.from('crm_activities').insert(payload);
        if (error) throw error;
        toast.success('Tarefa criada');
        // Notification
        await supabase.from('user_notifications').insert({
          user_id: user.id,
          title: '✅ Nova tarefa CRM criada',
          message: `Tarefa "${form.title}" foi criada.`,
          type: 'crm_task_created',
          action_url: '/crm',
        });
      }
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    const { error } = await supabase.from('crm_activities').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Erro ao concluir tarefa'); return; }
    toast.success('Tarefa concluída');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('crm_activities').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Tarefa excluída');
    fetchData();
  };

  const getOwnerName = (id: string | null) => {
    if (!id) return '—';
    return profiles.find(p => p.id === id)?.full_name || '—';
  };

  const getLinkedName = (task: Activity) => {
    if (task.deal_id) {
      const deal = deals.find(d => d.id === task.deal_id);
      return deal ? `📋 ${deal.name}` : '';
    }
    if (task.contact_id) {
      const contact = contacts.find(c => c.id === task.contact_id);
      return contact ? `👤 ${contact.name}` : '';
    }
    return '—';
  };

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOffset = getDay(monthStart);

  const tasksOnDay = (day: Date) =>
    activities.filter(a => a.due_date && isSameDay(parseISO(a.due_date), day));

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-3xl font-bold text-destructive">{summary.overdue}</p>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-3xl font-bold text-yellow-600">{summary.dueToday}</p>
              <p className="text-sm text-muted-foreground">Vencendo Hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-3xl font-bold text-green-600">{summary.completedWeek}</p>
              <p className="text-sm text-muted-foreground">Concluídas esta semana</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={viewMode} onValueChange={v => setViewMode(v as 'list' | 'calendar')} className="w-auto">
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-1"><List className="h-4 w-4" /> Lista</TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('title')}>
                    <span className="flex items-center">Título <SortIcon col="title" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                    <span className="flex items-center">Tipo <SortIcon col="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                    <span className="flex items-center">Prioridade <SortIcon col="priority" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('due_date')}>
                    <span className="flex items-center">Vencimento <SortIcon col="due_date" /></span>
                  </TableHead>
                  <TableHead>Vinculado a</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma tarefa pendente</TableCell></TableRow>
                )}
                {filteredTasks.map(task => {
                  const typeInfo = getTypeInfo(task.type);
                  const prioInfo = getPriorityInfo(task.priority || 'medium');
                  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
                  const TypeIcon = typeInfo.icon;
                  return (
                    <TableRow key={task.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1"><TypeIcon className="h-3 w-3" />{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={prioInfo.color + ' border-0'}>{prioInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                            {format(parseISO(task.due_date), "dd/MM/yyyy HH:mm")}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{getLinkedName(task)}</TableCell>
                      <TableCell className="text-sm">{getOwnerName(task.owner_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" title="Concluir" onClick={() => handleComplete(task.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(task)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(task.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="capitalize">{format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" onClick={() => setCalendarMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => setCalendarMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {/* Empty cells before first day (Mon=0) */}
              {Array.from({ length: (firstDayOffset + 6) % 7 }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
              ))}
              {calendarDays.map(day => {
                const dayTasks = tasksOnDay(day);
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`bg-background p-1.5 min-h-[80px] ${today ? 'ring-2 ring-primary ring-inset' : ''}`}
                  >
                    <span className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => {
                        const info = getTypeInfo(t.type);
                        return (
                          <div
                            key={t.id}
                            onClick={() => openEdit(t)}
                            className={`text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate ${t.completed ? 'line-through opacity-50 bg-muted' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                          >
                            {t.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Ligar para cliente..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Data/Hora de Vencimento</label>
              <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Vincular a</label>
              <Tabs value={form.linkType} onValueChange={v => setForm(f => ({ ...f, linkType: v as any, deal_id: '', contact_id: '' }))}>
                <TabsList className="w-full">
                  <TabsTrigger value="none" className="flex-1">Nenhum</TabsTrigger>
                  <TabsTrigger value="deal" className="flex-1">Negociação</TabsTrigger>
                  <TabsTrigger value="contact" className="flex-1">Contato</TabsTrigger>
                </TabsList>
              </Tabs>
              {form.linkType === 'deal' && (
                <Select value={form.deal_id} onValueChange={v => setForm(f => ({ ...f, deal_id: v }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Selecionar negociação..." /></SelectTrigger>
                  <SelectContent>
                    {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {form.linkType === 'contact' && (
                <Select value={form.contact_id} onValueChange={v => setForm(f => ({ ...f, contact_id: v }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Selecionar contato..." /></SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingTask ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
