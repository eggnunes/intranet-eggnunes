import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, User, DollarSign, Calendar, ChevronDown, Phone, Mail, RefreshCw, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DealStage {
  id: string;
  name: string;
  order_index: number;
  is_won: boolean;
  is_lost: boolean;
  pipeline_id: string;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  contact_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  contact?: {
    name: string;
    email: string | null;
    phone: string | null;
  };
}

interface CRMDealsKanbanProps {
  syncEnabled: boolean;
}

// Componente de card arrastável
const DraggableDealCard = ({ 
  deal, 
  stage, 
  stages, 
  onMove, 
  movingDeal,
  formatCurrency 
}: { 
  deal: Deal; 
  stage: DealStage;
  stages: DealStage[];
  onMove: (dealId: string, newStageId: string, currentStageId: string) => void;
  movingDeal: string | null;
  formatCurrency: (value: number) => string;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal, stageId: stage.id }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`hover:shadow-lg transition-all duration-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 hover:border-primary/50 rounded-lg ${isDragging ? 'shadow-xl ring-2 ring-primary' : ''}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight break-words">{deal.name}</p>
            {deal.contact && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{deal.contact.name}</span>
              </div>
            )}
          </div>
          
          {/* Dropdown to move */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0">
                Mover
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-50">
              {stages
                .filter(s => s.id !== stage.id)
                .map(targetStage => (
                  <DropdownMenuItem
                    key={targetStage.id}
                    onClick={() => onMove(deal.id, targetStage.id, stage.id)}
                    disabled={movingDeal === deal.id}
                  >
                    Mover para {targetStage.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
          {deal.value > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-600">
                {formatCurrency(deal.value)}
              </span>
            </div>
          )}
          
          {deal.expected_close_date && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {deal.contact?.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact.phone}</span>
            </div>
          )}

          {deal.contact?.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact.email}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Componente de coluna droppable
const DroppableColumn = ({ 
  stage, 
  index,
  children,
  stageDeals,
  stageValue,
  getStageHeaderColor,
  getStageColumnColor,
  formatCurrency,
}: { 
  stage: DealStage; 
  index: number;
  children: React.ReactNode;
  stageDeals: Deal[];
  stageValue: number;
  getStageHeaderColor: (stage: DealStage, index: number) => string;
  getStageColumnColor: (stage: DealStage) => string;
  formatCurrency: (value: number) => string;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 rounded-xl border-2 shadow-sm transition-all duration-200 ${getStageColumnColor(stage)} ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      {/* Header colorido */}
      <div className={`p-4 rounded-t-lg ${getStageHeaderColor(stage, index)}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide truncate mr-2">{stage.name}</h3>
          <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 shrink-0">
            {stageDeals.length}
          </Badge>
        </div>
        <p className="text-sm mt-1 opacity-90">
          {formatCurrency(stageValue)}
        </p>
      </div>

      <div className="h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto">
        <div className="p-3 space-y-3">
          {children}
          {stageDeals.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma oportunidade
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CRMDealsKanban = ({ syncEnabled }: CRMDealsKanbanProps) => {
  const { user } = useAuth();
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingDeal, setMovingDeal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('crm-deals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_deals' },
        () => fetchDeals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchStages(), fetchDeals()]);
    setLoading(false);
  };

  const fetchStages = async () => {
    const { data, error } = await supabase
      .from('crm_deal_stages')
      .select('*')
      .order('order_index');
    
    if (error) {
      console.error('Error fetching stages:', error);
      return;
    }
    setStages(data || []);
  };

  const fetchDeals = async () => {
    let allDeals: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: dealsBatch, error } = await supabase
        .from('crm_deals')
        .select(`
          *,
          contact:crm_contacts(name, email, phone)
        `)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('Error fetching deals:', error);
        break;
      }
      
      if (!dealsBatch || dealsBatch.length === 0) break;
      
      allDeals = [...allDeals, ...dealsBatch];
      
      if (dealsBatch.length < pageSize) break;
      page++;
      
      if (page > 20) break;
    }
    
    setDeals(allDeals);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStageHeaderColor = (stage: DealStage, index: number) => {
    if (stage.is_won) return 'bg-emerald-600 text-white';
    if (stage.is_lost) return 'bg-red-600 text-white';
    
    const colors = [
      'bg-blue-600 text-white',
      'bg-violet-600 text-white',
      'bg-amber-500 text-white',
      'bg-cyan-600 text-white',
      'bg-pink-600 text-white',
      'bg-indigo-600 text-white',
      'bg-orange-500 text-white',
      'bg-teal-600 text-white',
      'bg-rose-600 text-white',
      'bg-sky-600 text-white',
    ];
    return colors[index % colors.length];
  };

  const getStageColumnColor = (stage: DealStage) => {
    if (stage.is_won) return 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700';
    if (stage.is_lost) return 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-700';
    return 'bg-slate-200/70 dark:bg-slate-800/70 border-slate-300 dark:border-slate-600';
  };

  const getStageDeals = (stageId: string) => {
    return deals.filter(deal => {
      const matchesStage = deal.stage_id === stageId;
      const matchesSearch = searchTerm === '' || 
        deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStage && matchesSearch;
    });
  };

  const getStageValue = (stageId: string) => {
    return getStageDeals(stageId).reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
  };

  const handleMoveToStage = async (dealId: string, newStageId: string, currentStageId: string) => {
    if (newStageId === currentStageId) return;

    setMovingDeal(dealId);

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: newStageId } : d));

    try {
      if (syncEnabled) {
        const { data, error } = await supabase.functions.invoke('crm-sync', {
          body: {
            action: 'update_deal_stage',
            data: {
              deal_id: dealId,
              stage_id: newStageId,
              user_id: user?.id
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar');

        toast.success(`Oportunidade movida para ${data.stage_name}`);
      } else {
        const { error } = await supabase
          .from('crm_deals')
          .update({ stage_id: newStageId })
          .eq('id', dealId);

        if (error) throw error;

        await supabase.from('crm_deal_history').insert({
          deal_id: dealId,
          from_stage_id: currentStageId,
          to_stage_id: newStageId,
          changed_by: user?.id
        });

        const targetStage = stages.find(s => s.id === newStageId);
        toast.success(`Oportunidade movida para ${targetStage?.name || 'nova etapa'}`);
      }

      fetchDeals();
    } catch (error: any) {
      console.error('Error moving deal:', error);
      // Revert optimistic update
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: currentStageId } : d));
      toast.error(error?.message || 'Erro ao mover oportunidade');
    } finally {
      setMovingDeal(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = deals.find(d => d.id === active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const newStageId = over.id as string;
    const currentStageId = deal.stage_id;

    if (newStageId !== currentStageId && stages.some(s => s.id === newStageId)) {
      handleMoveToStage(dealId, newStageId, currentStageId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum pipeline configurado. Clique em "Sincronizar RD Station" para importar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar oportunidades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {syncEnabled && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <RefreshCw className="h-3 w-3 mr-1" />
            Sync bidirecional com RD Station
          </Badge>
        )}
      </div>

      {/* Kanban Board with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full overflow-x-auto pb-4">
          <div className="flex gap-5 min-w-max px-1 py-1">
            {stages.map((stage, index) => {
              const stageDeals = getStageDeals(stage.id);
              const stageValue = getStageValue(stage.id);

              return (
                <DroppableColumn
                  key={stage.id}
                  stage={stage}
                  index={index}
                  stageDeals={stageDeals}
                  stageValue={stageValue}
                  getStageHeaderColor={getStageHeaderColor}
                  getStageColumnColor={getStageColumnColor}
                  formatCurrency={formatCurrency}
                >
                  {stageDeals.map((deal) => (
                    <DraggableDealCard
                      key={deal.id}
                      deal={deal}
                      stage={stage}
                      stages={stages}
                      onMove={handleMoveToStage}
                      movingDeal={movingDeal}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDeal ? (
            <Card className="w-72 shadow-2xl border-2 border-primary bg-white dark:bg-slate-950 rounded-lg opacity-90">
              <CardContent className="p-3">
                <p className="font-semibold text-sm">{activeDeal.name}</p>
                {activeDeal.value > 0 && (
                  <p className="text-xs text-emerald-600 font-medium mt-1">
                    {formatCurrency(activeDeal.value)}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
