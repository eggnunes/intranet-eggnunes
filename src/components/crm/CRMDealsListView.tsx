import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, SortAsc, SortDesc, X, Eye, MoveRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  owner_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  product_name: string | null;
  campaign_name: string | null;
  notes: string | null;
  rd_station_id: string | null;
  custom_fields: Record<string, unknown> | null;
  won: boolean | null;
  closed_at: string | null;
  loss_reason: string | null;
  contact?: {
    name: string;
    lead_score: number | null;
  };
  owner?: { id: string; full_name: string; email: string };
}

interface CRMDealsListViewProps {
  deals: Deal[];
  stages: DealStage[];
  profiles: Record<string, { full_name: string; email: string }>;
  formatCurrency: (value: number) => string;
  onMoveDeal: (dealId: string, newStageId: string, currentStageId: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onViewDeal: (deal: any) => void;
}

export const CRMDealsListView = ({
  deals,
  stages,
  profiles,
  formatCurrency,
  onMoveDeal,
  onViewDeal,
}: CRMDealsListViewProps) => {
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // List-specific filters
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Bulk action
  const [bulkTargetStage, setBulkTargetStage] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);

  const uniqueOwners = useMemo(() => {
    return [...new Set(deals.map(d => d.owner_id).filter(Boolean))] as string[];
  }, [deals]);

  const getDealStatus = (deal: Deal): string => {
    const stage = stages.find(s => s.id === deal.stage_id);
    if (stage?.is_won || deal.won === true) return 'Ganha';
    if (stage?.is_lost || deal.won === false) return 'Perdida';
    return 'Aberta';
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'Ganha') return 'default';
    if (status === 'Perdida') return 'destructive';
    return 'secondary';
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...deals];

    // Apply filters
    if (filterOwner !== 'all') {
      result = result.filter(d => d.owner_id === filterOwner);
    }
    if (filterStage !== 'all') {
      result = result.filter(d => d.stage_id === filterStage);
    }
    if (filterDateFrom) {
      result = result.filter(d => new Date(d.created_at) >= new Date(filterDateFrom));
    }
    if (filterDateTo) {
      const end = new Date(filterDateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(d => new Date(d.created_at) <= end);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'owner': {
          const ownerA = a.owner_id ? profiles[a.owner_id]?.full_name || '' : '';
          const ownerB = b.owner_id ? profiles[b.owner_id]?.full_name || '' : '';
          cmp = ownerA.localeCompare(ownerB);
          break;
        }
        case 'lead_score':
          cmp = (a.contact?.lead_score || 0) - (b.contact?.lead_score || 0);
          break;
        case 'stage': {
          const stageA = stages.find(s => s.id === a.stage_id)?.order_index || 0;
          const stageB = stages.find(s => s.id === b.stage_id)?.order_index || 0;
          cmp = stageA - stageB;
          break;
        }
        case 'value':
          cmp = (a.value || 0) - (b.value || 0);
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status': {
          cmp = getDealStatus(a).localeCompare(getDealStatus(b));
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [deals, filterOwner, filterStage, filterDateFrom, filterDateTo, sortColumn, sortDir, profiles, stages]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <SortAsc className="h-3.5 w-3.5 ml-1 text-primary" />
      : <SortDesc className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const toggleAll = () => {
    if (selectedDeals.size === filteredAndSorted.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredAndSorted.map(d => d.id)));
    }
  };

  const toggleDeal = (id: string) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkMove = async () => {
    if (!bulkTargetStage || selectedDeals.size === 0) return;
    setBulkMoving(true);
    let moved = 0;
    for (const dealId of selectedDeals) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage_id !== bulkTargetStage) {
        try {
          await onMoveDeal(dealId, bulkTargetStage, deal.stage_id);
          moved++;
        } catch {
          // onMoveDeal already handles toast errors
        }
      }
    }
    if (moved > 0) {
      toast.success(`${moved} negociação(ões) movida(s)`);
    }
    setSelectedDeals(new Set());
    setBulkTargetStage('');
    setBulkMoving(false);
  };

  const hasActiveFilters = filterOwner !== 'all' || filterStage !== 'all' || filterDateFrom !== '' || filterDateTo !== '';

  const clearFilters = () => {
    setFilterOwner('all');
    setFilterStage('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {uniqueOwners.map(id => (
              <SelectItem key={id} value={id}>
                {profiles[id]?.full_name || 'Sem nome'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {stages.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">De:</span>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Até:</span>
          <Input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="w-[150px]"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedDeals.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedDeals.size} selecionada(s)
          </span>
          <Select value={bulkTargetStage} onValueChange={setBulkTargetStage}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Mover para etapa..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!bulkTargetStage || bulkMoving}
            onClick={handleBulkMove}
          >
            <MoveRight className="h-4 w-4 mr-1" />
            {bulkMoving ? 'Movendo...' : 'Aplicar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDeals(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={filteredAndSorted.length > 0 && selectedDeals.size === filteredAndSorted.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                <span className="flex items-center">Negociação <SortIcon col="name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('owner')}>
                <span className="flex items-center">Responsável <SortIcon col="owner" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('lead_score')}>
                <span className="flex items-center">Qualificação <SortIcon col="lead_score" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('stage')}>
                <span className="flex items-center">Etapa <SortIcon col="stage" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('value')}>
                <span className="flex items-center justify-end">Valor <SortIcon col="value" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                <span className="flex items-center">Criação <SortIcon col="created_at" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                <span className="flex items-center">Status <SortIcon col="status" /></span>
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma negociação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map(deal => {
                const stage = stages.find(s => s.id === deal.stage_id);
                const status = getDealStatus(deal);
                const ownerName = deal.owner_id ? profiles[deal.owner_id]?.full_name : null;

                return (
                  <TableRow key={deal.id} data-state={selectedDeals.has(deal.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDeals.has(deal.id)}
                        onCheckedChange={() => toggleDeal(deal.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{deal.name}</span>
                        {deal.contact && (
                          <p className="text-xs text-muted-foreground">{deal.contact.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ownerName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {deal.contact?.lead_score != null && deal.contact.lead_score > 0 ? (
                        <Badge variant="outline" className="font-mono">
                          {deal.contact.lead_score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {stage?.name || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {deal.value > 0 ? formatCurrency(deal.value) : '—'}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(deal.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDeal(deal)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{filteredAndSorted.length} negociação(ões)</span>
        <span>
          Total: {formatCurrency(filteredAndSorted.reduce((sum, d) => sum + (d.value || 0), 0))}
        </span>
      </div>
    </div>
  );
};
