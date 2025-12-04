import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TaskCreationForm, TaskFormData } from '@/components/TaskCreationForm';

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
  // Pre-fill fields from suggestion rules
  prefillTaskTypeId?: number;
  prefillResponsibleId?: string | null;
  prefillDeadline?: string;
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

  useEffect(() => {
    if (open && selectedMovement) {
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

  const handleSubmit = async (taskData: any) => {
    if (!selectedMovement) return;

    setIsCreating(true);
    
    try {
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

  const getInitialData = (): TaskFormData | null => {
    if (!selectedMovement) return null;
    
    const lawsuit = lawsuits.find(l => l.id === selectedMovement.lawsuit_id);
    
    return {
      lawsuitId: selectedMovement.lawsuit_id || lawsuit?.id || 0,
      processNumber: selectedMovement.process_number,
      title: selectedMovement.title || '',
      description: selectedMovement.header || selectedMovement.title || '',
      customerName: getCustomerName(selectedMovement.customers),
      // Pre-fill from suggestion rules
      prefillTaskTypeId: selectedMovement.prefillTaskTypeId,
      prefillResponsibleId: selectedMovement.prefillResponsibleId,
      prefillDeadline: selectedMovement.prefillDeadline,
    };
  };

  const initialData = getInitialData();

  if (!initialData) return null;

  const DialogWrapper = isMobile ? Drawer : Dialog;
  const DialogContentWrapper = isMobile ? DrawerContent : DialogContent;
  const DialogHeaderWrapper = isMobile ? DrawerHeader : DialogHeader;
  const DialogTitleWrapper = isMobile ? DrawerTitle : DialogTitle;
  const DialogDescriptionWrapper = isMobile ? DrawerDescription : DialogDescription;

  return (
    <DialogWrapper open={open} onOpenChange={onOpenChange}>
      <DialogContentWrapper className={isMobile ? 'max-h-[85vh]' : 'max-w-2xl max-h-[90vh] overflow-y-auto'}>
        <DialogHeaderWrapper className="flex-shrink-0">
          <DialogTitleWrapper>Criar Tarefa</DialogTitleWrapper>
          <DialogDescriptionWrapper>
            Processo: {initialData.processNumber}
          </DialogDescriptionWrapper>
        </DialogHeaderWrapper>
        
        <div className={isMobile ? 'px-4 pb-6' : 'px-6 pb-6'}>
          {/* Movement Info */}
          <div className="bg-muted/30 p-3 rounded-md text-sm space-y-2 border mb-4">
            <p>
              <span className="font-medium">Processo:</span> {initialData.processNumber}
            </p>
            <p>
              <span className="font-medium">Movimentação:</span> {initialData.title}
            </p>
            {initialData.customerName && (
              <p>
                <span className="font-medium">Cliente:</span> {initialData.customerName}
              </p>
            )}
          </div>

          <TaskCreationForm
            initialData={initialData}
            taskTypes={taskTypes}
            advboxUsers={advboxUsers}
            loadingTaskTypes={loadingTaskTypes}
            loadingUsers={loadingUsers}
            onFetchTaskTypes={fetchTaskTypes}
            onFetchUsers={fetchUsers}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isCreating}
          />
        </div>
      </DialogContentWrapper>
    </DialogWrapper>
  );
}
