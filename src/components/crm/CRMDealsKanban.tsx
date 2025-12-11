import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, Search, User, DollarSign, Calendar, ChevronDown, Phone, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

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

export const CRMDealsKanban = ({ syncEnabled }: CRMDealsKanbanProps) => {
  const { user } = useAuth();
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingDeal, setMovingDeal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    // Fetch ALL deals with pagination to avoid 1000 limit
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
      
      // Safety limit
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
    
    // Cores variadas para cada estágio
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
    if (stage.is_won) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
    if (stage.is_lost) return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
    return 'bg-muted/30 border-border';
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

    try {
      if (syncEnabled) {
        // Bidirectional sync - update RD Station and local
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
        // Local only update
        const { error } = await supabase
          .from('crm_deals')
          .update({ stage_id: newStageId })
          .eq('id', dealId);

        if (error) throw error;

        // Log history
        await supabase.from('crm_deal_history').insert({
          deal_id: dealId,
          from_stage_id: currentStageId,
          to_stage_id: newStageId,
          changed_by: user?.id
        });

        toast.success('Oportunidade movida');
      }

      fetchDeals();
    } catch (error: any) {
      console.error('Error moving deal:', error);
      toast.error(error?.message || 'Erro ao mover oportunidade');
    } finally {
      setMovingDeal(null);
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

      {/* Kanban Board */}
      <ScrollArea className="w-full whitespace-nowrap pb-4">
        <div className="flex gap-4 min-w-max pr-4">
          {stages.map((stage, index) => {
            const stageDeals = getStageDeals(stage.id);
            const stageValue = getStageValue(stage.id);

            return (
              <div
                key={stage.id}
                className={`w-80 flex-shrink-0 rounded-xl border shadow-sm overflow-hidden ${getStageColumnColor(stage)}`}
              >
                {/* Header colorido */}
                <div className={`p-4 ${getStageHeaderColor(stage, index)}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm uppercase tracking-wide">{stage.name}</h3>
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1 opacity-90">
                    {formatCurrency(stageValue)}
                  </p>
                </div>

                <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
                  <div className="p-3 space-y-3">
                    {stageDeals.map((deal) => (
                      <Card key={deal.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 border-border bg-slate-50 dark:bg-slate-900/50 hover:border-primary/50 overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="font-semibold text-sm leading-tight break-words">{deal.name}</p>
                              {deal.contact && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{deal.contact.name}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Mobile: Dropdown to move */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 hover:bg-primary/10">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {stages
                                  .filter(s => s.id !== stage.id)
                                  .map(targetStage => (
                                    <DropdownMenuItem
                                      key={targetStage.id}
                                      onClick={() => handleMoveToStage(deal.id, targetStage.id, stage.id)}
                                      disabled={movingDeal === deal.id}
                                    >
                                      Mover para {targetStage.name}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            {deal.value > 0 && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="font-semibold text-emerald-600">
                                  {formatCurrency(deal.value)}
                                </span>
                              </div>
                            )}
                            
                            {deal.expected_close_date && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}

                            {deal.contact?.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{deal.contact.phone}</span>
                              </div>
                            )}

                            {deal.contact?.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{deal.contact.email}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        Nenhuma oportunidade
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
