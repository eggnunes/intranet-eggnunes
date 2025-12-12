import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Clock, Calendar as CalendarIcon, Check, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface FollowUpReminder {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string;
  reminder_date: string;
  title: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  deal?: { name: string };
  contact?: { name: string };
}

interface Deal {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
}

export const CRMFollowUp = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    reminder_date: new Date(),
    deal_id: '',
    contact_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReminders();
      fetchDealsAndContacts();
    }
  }, [user, showCompleted]);

  const fetchReminders = async () => {
    let query = supabase
      .from('crm_follow_up_reminders')
      .select(`
        *,
        deal:crm_deals(name),
        contact:crm_contacts(name)
      `)
      .order('reminder_date', { ascending: true });

    if (!showCompleted) {
      query = query.eq('completed', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reminders:', error);
    } else {
      setReminders(data || []);
    }
    setLoading(false);
  };

  const fetchDealsAndContacts = async () => {
    const [dealsRes, contactsRes] = await Promise.all([
      supabase.from('crm_deals').select('id, name').is('closed_at', null).order('name'),
      supabase.from('crm_contacts').select('id, name').order('name'),
    ]);

    setDeals(dealsRes.data || []);
    setContacts(contactsRes.data || []);
  };

  const openNewReminder = () => {
    setFormData({
      title: '',
      notes: '',
      reminder_date: new Date(),
      deal_id: '',
      contact_id: '',
    });
    setDialogOpen(true);
  };

  const saveReminder = async () => {
    if (!user || !formData.title) {
      toast.error('Preencha o título do lembrete');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('crm_follow_up_reminders')
        .insert({
          title: formData.title,
          notes: formData.notes || null,
          reminder_date: formData.reminder_date.toISOString(),
          deal_id: formData.deal_id || null,
          contact_id: formData.contact_id || null,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success('Lembrete criado com sucesso');
      setDialogOpen(false);
      fetchReminders();
    } catch (error: any) {
      console.error('Error saving reminder:', error);
      toast.error('Erro ao salvar lembrete: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('crm_follow_up_reminders')
      .update({
        completed: !currentStatus,
        completed_at: !currentStatus ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar lembrete');
    } else {
      toast.success(currentStatus ? 'Lembrete reaberto' : 'Lembrete concluído');
      fetchReminders();
    }
  };

  const deleteReminder = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lembrete?')) return;

    const { error } = await supabase
      .from('crm_follow_up_reminders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir lembrete');
    } else {
      toast.success('Lembrete excluído');
      fetchReminders();
    }
  };

  const isOverdue = (date: string) => {
    return new Date(date) < new Date() && !showCompleted;
  };

  const isToday = (date: string) => {
    const today = new Date();
    const reminderDate = new Date(date);
    return (
      today.getDate() === reminderDate.getDate() &&
      today.getMonth() === reminderDate.getMonth() &&
      today.getFullYear() === reminderDate.getFullYear()
    );
  };

  const pendingCount = reminders.filter(r => !r.completed).length;
  const overdueCount = reminders.filter(r => !r.completed && isOverdue(r.reminder_date)).length;
  const todayCount = reminders.filter(r => !r.completed && isToday(r.reminder_date)).length;

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
          <Bell className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Lembretes de Follow-up</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="showCompleted"
              checked={showCompleted}
              onCheckedChange={(checked) => setShowCompleted(checked === true)}
            />
            <Label htmlFor="showCompleted" className="text-sm">
              Mostrar concluídos
            </Label>
          </div>
          <Button onClick={openNewReminder}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Lembrete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className={overdueCount > 0 ? 'border-red-500/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Atrasados</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{overdueCount}</p>
          </CardContent>
        </Card>
        <Card className={todayCount > 0 ? 'border-amber-500/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Hoje</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{todayCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {reminders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lembrete {showCompleted ? '' : 'pendente'}</p>
              <Button variant="outline" className="mt-4" onClick={openNewReminder}>
                <Plus className="h-4 w-4 mr-1" />
                Criar Lembrete
              </Button>
            </CardContent>
          </Card>
        ) : (
          reminders.map((reminder) => (
            <Card 
              key={reminder.id} 
              className={`${reminder.completed ? 'opacity-60' : ''} ${
                isOverdue(reminder.reminder_date) && !reminder.completed ? 'border-red-500/50' : ''
              } ${isToday(reminder.reminder_date) && !reminder.completed ? 'border-amber-500/50' : ''}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={reminder.completed}
                      onCheckedChange={() => toggleComplete(reminder.id, reminder.completed)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${reminder.completed ? 'line-through' : ''}`}>
                          {reminder.title}
                        </span>
                        {isOverdue(reminder.reminder_date) && !reminder.completed && (
                          <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                        )}
                        {isToday(reminder.reminder_date) && !reminder.completed && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                            Hoje
                          </Badge>
                        )}
                      </div>
                      {reminder.notes && (
                        <p className="text-sm text-muted-foreground">{reminder.notes}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(reminder.reminder_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {reminder.deal && (
                          <Badge variant="secondary" className="text-xs">
                            Deal: {reminder.deal.name}
                          </Badge>
                        )}
                        {reminder.contact && (
                          <Badge variant="secondary" className="text-xs">
                            Contato: {reminder.contact.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => deleteReminder(reminder.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lembrete de Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Ligar para cliente sobre proposta"
              />
            </div>

            <div className="space-y-2">
              <Label>Data e Hora</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(formData.reminder_date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.reminder_date}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, reminder_date: date }))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deal (opcional)</Label>
                <Select
                  value={formData.deal_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, deal_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar deal..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {deals.map(deal => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contato (opcional)</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, contact_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar contato..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Adicione notas sobre o follow-up..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveReminder} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Lembrete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
