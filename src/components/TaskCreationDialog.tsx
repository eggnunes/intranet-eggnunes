import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { RefreshCw, Calendar as CalendarIcon, Clock, MapPin, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskType {
  id: string | number;
  name: string;
}

interface AdvboxUser {
  id: number;
  name: string;
  email?: string;
}

interface Movement {
  lawsuit_id: number;
  date: string;
  title: string;
  header: string;
  process_number: string;
  protocol_number: string | null;
  customers: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

interface Lawsuit {
  id: number;
  process_number: string;
  responsible_id: number;
  responsible: string;
  customers?: string | { name: string; customer_id?: number; identification?: string; origin?: string } | { name: string; customer_id?: number; identification?: string; origin?: string }[];
}

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMovement: Movement | null;
  lawsuits: Lawsuit[];
  onTaskCreated: () => void;
}

export function TaskCreationDialog({ 
  open, 
  onOpenChange, 
  selectedMovement, 
  lawsuits,
  onTaskCreated 
}: TaskCreationDialogProps) {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [advboxUsers, setAdvboxUsers] = useState<AdvboxUser[]>([]);
  const [loadingTaskTypes, setLoadingTaskTypes] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form fields
  const [taskTypeId, setTaskTypeId] = useState('');
  const [comments, setComments] = useState('');
  const [fromUserId, setFromUserId] = useState('');
  const [selectedGuests, setSelectedGuests] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [local, setLocal] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState(true);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const getCustomerName = (customers: Movement['customers'] | Lawsuit['customers']): string => {
    if (!customers) return '';
    if (typeof customers === 'string') return customers;
    if (Array.isArray(customers)) {
      return customers.map((c) => c.name).join(', ');
    }
    return customers.name ?? '';
  };

  // Reset form when dialog opens with a new movement
  useEffect(() => {
    if (open && selectedMovement) {
      setComments(selectedMovement.header || selectedMovement.title || '');
      setStartDate(new Date());
      setStartTime('09:00');
      setEndDate(undefined);
      setEndTime('');
      setDeadlineDate(undefined);
      setLocal('');
      setIsUrgent(false);
      setIsImportant(false);
      setDisplaySchedule(true);
      setSelectedGuests([]);
      
      // Find the lawsuit to get the responsible
      const lawsuit = lawsuits.find(l => l.id === selectedMovement.lawsuit_id);
      if (lawsuit?.responsible_id) {
        setFromUserId(String(lawsuit.responsible_id));
        setSelectedGuests([lawsuit.responsible_id]);
      }
      
      // Fetch data if needed
      if (taskTypes.length === 0) fetchTaskTypes();
      if (advboxUsers.length === 0) fetchUsers();
    }
  }, [open, selectedMovement]);

  const fetchTaskTypes = async () => {
    setLoadingTaskTypes(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/task-types');
      if (error) throw error;
      
      const rawData = data?.data || [];
      const types = Array.isArray(rawData) ? rawData.map((t: any) => ({
        id: t.id || t.tasks_id,
        name: t.task || t.name || t.title || `Tipo ${t.id || t.tasks_id}`,
      })).filter((t: any) => t.id && t.name) : [];
      
      setTaskTypes(types);
    } catch (err) {
      console.error('Erro ao buscar tipos de tarefa:', err);
    } finally {
      setLoadingTaskTypes(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/users');
      if (error) throw error;
      
      const rawData = data?.data || data?.users || [];
      const users = Array.isArray(rawData) ? rawData.map((u: any) => ({
        id: u.id || u.user_id,
        name: u.name || u.full_name || u.email || `Usuário ${u.id}`,
        email: u.email,
      })).filter((u: any) => u.id) : [];
      
      setAdvboxUsers(users);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      // Fallback: extract unique responsibles from lawsuits
      const uniqueResponsibles = new Map<number, AdvboxUser>();
      lawsuits.forEach(l => {
        if (l.responsible_id && l.responsible) {
          uniqueResponsibles.set(l.responsible_id, {
            id: l.responsible_id,
            name: l.responsible,
          });
        }
      });
      setAdvboxUsers(Array.from(uniqueResponsibles.values()));
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleGuest = (userId: number) => {
    setSelectedGuests(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateTask = async () => {
    if (!selectedMovement || !taskTypeId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione o tipo de tarefa.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const lawsuit = lawsuits.find(l => l.id === selectedMovement.lawsuit_id);
      
      if (!lawsuit) {
        throw new Error('Processo não encontrado');
      }

      const taskData: Record<string, any> = {
        lawsuits_id: selectedMovement.lawsuit_id || lawsuit.id,
        tasks_id: taskTypeId,
        from: fromUserId || lawsuit.responsible_id,
        guests: selectedGuests.length > 0 ? selectedGuests : [lawsuit.responsible_id],
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        comments: comments || selectedMovement.header || selectedMovement.title,
      };

      // Optional fields
      if (startTime) taskData.start_time = startTime;
      if (endDate) taskData.end_date = format(endDate, 'yyyy-MM-dd');
      if (endTime) taskData.end_time = endTime;
      if (deadlineDate) taskData.date_deadline = format(deadlineDate, 'yyyy-MM-dd');
      if (local) taskData.local = local;
      if (isUrgent) taskData.urgent = true;
      if (isImportant) taskData.important = true;
      taskData.display_schedule = displaySchedule;

      console.log('Creating task with data:', taskData);

      const { error } = await supabase.functions.invoke('advbox-integration/create-task', {
        body: taskData,
      });

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'Tarefa criada com sucesso no Advbox.',
      });

      onTaskCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: error instanceof Error ? error.message : 'Não foi possível criar a tarefa.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const FormContent = () => (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-6">
        {/* Movement Info */}
        {selectedMovement && (
          <div className="bg-muted/30 p-3 rounded-md text-sm space-y-2 border">
            <p>
              <span className="font-medium">Processo:</span> {selectedMovement.process_number}
            </p>
            <p>
              <span className="font-medium">Movimentação:</span> {selectedMovement.title}
            </p>
            {selectedMovement.customers && (
              <p>
                <span className="font-medium">Cliente:</span> {getCustomerName(selectedMovement.customers)}
              </p>
            )}
          </div>
        )}

        {/* Tipo de Tarefa */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipo de Tarefa *</Label>
          {loadingTaskTypes ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : taskTypes.length > 0 ? (
            <Select value={taskTypeId} onValueChange={setTaskTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de tarefa" />
              </SelectTrigger>
              <SelectContent>
                {taskTypes.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Input
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
                placeholder="ID do tipo de tarefa"
              />
              <Button variant="outline" size="sm" onClick={fetchTaskTypes}>
                <RefreshCw className="h-3 w-3 mr-1" /> Carregar tipos
              </Button>
            </div>
          )}
        </div>

        {/* Responsável (from) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Responsável (Criador) *</Label>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : advboxUsers.length > 0 ? (
            <Select value={fromUserId} onValueChange={setFromUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {advboxUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={fromUserId}
              onChange={(e) => setFromUserId(e.target.value)}
              placeholder="ID do responsável"
            />
          )}
        </div>

        {/* Convidados (guests) - Multi-select */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participantes
          </Label>
          {advboxUsers.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedGuests.map(guestId => {
                  const user = advboxUsers.find(u => u.id === guestId);
                  return (
                    <Badge key={guestId} variant="secondary" className="gap-1">
                      {user?.name || `ID: ${guestId}`}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => toggleGuest(guestId)}
                      />
                    </Badge>
                  );
                })}
              </div>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-2">
                  {advboxUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`guest-${user.id}`}
                        checked={selectedGuests.includes(user.id)}
                        onCheckedChange={() => toggleGuest(user.id)}
                      />
                      <label htmlFor={`guest-${user.id}`} className="text-sm cursor-pointer">
                        {user.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Os participantes serão definidos automaticamente.
            </p>
          )}
        </div>

        {/* Data e Hora de Início */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Data *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hora
            </Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        {/* Data e Hora de Término */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data Término</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Opcional"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Hora Término</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="HH:MM"
            />
          </div>
        </div>

        {/* Prazo Fatal */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-destructive flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Prazo Fatal
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !deadlineDate && "text-muted-foreground"
                )}
              >
                {deadlineDate ? format(deadlineDate, "dd/MM/yyyy") : "Selecionar prazo fatal"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deadlineDate}
                onSelect={setDeadlineDate}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Local */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Local do Evento
          </Label>
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex: Sala de reuniões, Fórum, etc."
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Descrição da Tarefa</Label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Descreva os detalhes da tarefa..."
            rows={4}
          />
        </div>

        {/* Flags: Urgente, Importante, Mostrar na Agenda */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-medium">Opções</Label>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="urgent"
                checked={isUrgent}
                onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
              />
              <label htmlFor="urgent" className="text-sm cursor-pointer font-medium text-orange-600">
                Urgente
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="important"
                checked={isImportant}
                onCheckedChange={(checked) => setIsImportant(checked as boolean)}
              />
              <label htmlFor="important" className="text-sm cursor-pointer font-medium text-blue-600">
                Importante
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="display_schedule"
                checked={displaySchedule}
                onCheckedChange={(checked) => setDisplaySchedule(checked as boolean)}
              />
              <label htmlFor="display_schedule" className="text-sm cursor-pointer">
                Mostrar na Agenda
              </label>
            </div>
          </div>
        </div>

        {/* Nota sobre campos não disponíveis */}
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>Nota:</strong> As opções Futura, Recorrente, Privada, Retroativa e Anexar Arquivos 
          não estão disponíveis via API do Advbox.
        </p>

        {/* Buttons */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleCreateTask} 
            className="flex-1"
            disabled={!taskTypeId || isCreating}
          >
            {isCreating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Tarefa'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isCreating}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Criar Tarefa</DrawerTitle>
            <DrawerDescription>
              Preencha os campos para criar a tarefa no Advbox
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <FormContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Criar Tarefa</DialogTitle>
          <DialogDescription>
            Preencha os campos para criar a tarefa no Advbox
          </DialogDescription>
        </DialogHeader>
        <FormContent />
      </DialogContent>
    </Dialog>
  );
}
