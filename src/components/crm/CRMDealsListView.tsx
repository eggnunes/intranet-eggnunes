import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ArrowUpDown, SortAsc, SortDesc, X, Eye, MoveRight, Search, Download, UserPlus, Settings2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  onRefresh?: () => void;
}

type SortColumn = 'name' | 'owner' | 'lead_score' | 'stage' | 'value' | 'created_at' | 'status';
type SortDir = 'asc' | 'desc';

const ALL_COLUMNS = ['name', 'owner', 'lead_score', 'stage', 'value', 'created_at', 'status'] as const;
type ColumnKey = typeof ALL_COLUMNS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Negociação',
  owner: 'Responsável',
  lead_score: 'Qualificação',
  stage: 'Etapa',
  value: 'Valor',
  created_at: 'Criação',
  status: 'Status',
};

const DEFAULT_COLUMNS = new Set<ColumnKey>(ALL_COLUMNS);

function loadVisibleColumns(): Set<ColumnKey> {
  try {
    const saved = localStorage.getItem('crm-list-columns');
    if (saved) {
      const arr = JSON.parse(saved) as string[];
      return new Set(arr.filter(c => ALL_COLUMNS.includes(c as ColumnKey)) as ColumnKey[]);
    }
  } catch { /* ignore */ }
  return new Set(DEFAULT_COLUMNS);
}

export const CRMDealsListView = ({
  deals,
  stages,
  profiles,
  formatCurrency,
  onMoveDeal,
  onViewDeal,
  onRefresh,
}: CRMDealsListViewProps) => {
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterValueMin, setFilterValueMin] = useState('');
  const [filterValueMax, setFilterValueMax] = useState('');

  // Bulk actions
  const [bulkTargetStage, setBulkTargetStage] = useState('');
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkChangingStatus, setBulkChangingStatus] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('crm-list-page-size');
    return saved ? Number(saved) : 25;
  });

  // Visible columns
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadVisibleColumns);

  useEffect(() => {
    localStorage.setItem('crm-list-columns', JSON.stringify([...visibleColumns]));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('crm-list-page-size', String(pageSize));
  }, [pageSize]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchText, filterOwner, filterStage, filterStatus, filterDateFrom, filterDateTo, filterValueMin, filterValueMax, pageSize]);

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
    if (status === 'Ganha') return 'default' as const;
    if (status === 'Perdida') return 'destructive' as const;
    return 'secondary' as const;
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...deals];

    // Text search
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.contact?.name?.toLowerCase().includes(q) ||
        d.product_name?.toLowerCase().includes(q)
      );
    }

    if (filterOwner !== 'all') result = result.filter(d => d.owner_id === filterOwner);
    if (filterStage !== 'all') result = result.filter(d => d.stage_id === filterStage);
    if (filterStatus !== 'all') result = result.filter(d => getDealStatus(d) === filterStatus);
    if (filterDateFrom) result = result.filter(d => new Date(d.created_at) >= new Date(filterDateFrom));
    if (filterDateTo) {
      const end = new Date(filterDateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(d => new Date(d.created_at) <= end);
    }
    if (filterValueMin) result = result.filter(d => (d.value || 0) >= Number(filterValueMin));
    if (filterValueMax) result = result.filter(d => (d.value || 0) <= Number(filterValueMax));

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'owner': {
          const oA = a.owner_id ? profiles[a.owner_id]?.full_name || '' : '';
          const oB = b.owner_id ? profiles[b.owner_id]?.full_name || '' : '';
          cmp = oA.localeCompare(oB); break;
        }
        case 'lead_score': cmp = (a.contact?.lead_score || 0) - (b.contact?.lead_score || 0); break;
        case 'stage': {
          const sA = stages.find(s => s.id === a.stage_id)?.order_index || 0;
          const sB = stages.find(s => s.id === b.stage_id)?.order_index || 0;
          cmp = sA - sB; break;
        }
        case 'value': cmp = (a.value || 0) - (b.value || 0); break;
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'status': cmp = getDealStatus(a).localeCompare(getDealStatus(b)); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [deals, searchText, filterOwner, filterStage, filterStatus, filterDateFrom, filterDateTo, filterValueMin, filterValueMax, sortColumn, sortDir, profiles, stages]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedDeals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, page, pageSize]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <SortAsc className="h-3.5 w-3.5 ml-1 text-primary" />
      : <SortDesc className="h-3.5 w-3.5 ml-1 text-primary" />;
  };

  const toggleAll = () => {
    if (selectedDeals.size === paginatedDeals.length) setSelectedDeals(new Set());
    else setSelectedDeals(new Set(paginatedDeals.map(d => d.id)));
  };

  const toggleDeal = (id: string) => {
    setSelectedDeals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
        try { await onMoveDeal(dealId, bulkTargetStage, deal.stage_id); moved++; } catch { /* handled */ }
      }
    }
    if (moved > 0) toast.success(`${moved} negociação(ões) movida(s)`);
    setSelectedDeals(new Set());
    setBulkTargetStage('');
    setBulkMoving(false);
  };

  const handleBulkAssignOwner = async () => {
    if (!bulkOwner || selectedDeals.size === 0) return;
    setBulkAssigning(true);
    const ids = [...selectedDeals];
    const { error } = await supabase.from('crm_deals').update({ owner_id: bulkOwner }).in('id', ids);
    if (error) { toast.error('Erro ao atribuir responsável'); }
    else { toast.success(`Responsável atribuído a ${ids.length} negociação(ões)`); onRefresh?.(); }
    setSelectedDeals(new Set());
    setBulkOwner('');
    setBulkAssigning(false);
  };

  const handleBulkChangeStatus = async () => {
    if (!bulkStatus || selectedDeals.size === 0) return;
    setBulkChangingStatus(true);
    const ids = [...selectedDeals];
    const updateData: Record<string, unknown> = {};
    if (bulkStatus === 'won') { updateData.won = true; updateData.closed_at = new Date().toISOString(); }
    else if (bulkStatus === 'lost') { updateData.won = false; updateData.closed_at = new Date().toISOString(); }
    else { updateData.won = null; updateData.closed_at = null; }
    const { error } = await supabase.from('crm_deals').update(updateData).in('id', ids);
    if (error) { toast.error('Erro ao mudar status'); }
    else { toast.success(`Status alterado de ${ids.length} negociação(ões)`); onRefresh?.(); }
    setSelectedDeals(new Set());
    setBulkStatus('');
    setBulkChangingStatus(false);
  };

  const handleExportCSV = () => {
    const dataToExport = selectedDeals.size > 0
      ? filteredAndSorted.filter(d => selectedDeals.has(d.id))
      : filteredAndSorted;

    const headers = ['Negociação', 'Contato', 'Responsável', 'Qualificação', 'Etapa', 'Valor', 'Data Criação', 'Status'];
    const rows = dataToExport.map(d => [
      d.name,
      d.contact?.name || '',
      d.owner_id ? profiles[d.owner_id]?.full_name || '' : '',
      String(d.contact?.lead_score || ''),
      stages.find(s => s.id === d.stage_id)?.name || '',
      String(d.value || 0),
      format(new Date(d.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      getDealStatus(d),
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `negociacoes_crm_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${dataToExport.length} negociação(ões) exportada(s)`);
  };

  const toggleColumn = (col: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col) && next.size > 1) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const resetColumns = () => setVisibleColumns(new Set(DEFAULT_COLUMNS));

  const hasActiveFilters = filterOwner !== 'all' || filterStage !== 'all' || filterStatus !== 'all' || filterDateFrom !== '' || filterDateTo !== '' || filterValueMin !== '' || filterValueMax !== '' || searchText !== '';

  const clearFilters = () => {
    setSearchText('');
    setFilterOwner('all');
    setFilterStage('all');
    setFilterStatus('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterValueMin('');
    setFilterValueMax('');
  };

  const isCol = (c: ColumnKey) => visibleColumns.has(c);
  const colCount = visibleColumns.size + 2; // checkbox + actions

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar negociação..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 w-[200px]"
          />
        </div>

        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {uniqueOwners.map(id => (
              <SelectItem key={id} value={id}>{profiles[id]?.full_name || 'Sem nome'}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="Aberta">Aberta</SelectItem>
            <SelectItem value="Ganha">Ganha</SelectItem>
            <SelectItem value="Perdida">Perdida</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">De:</span>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[140px]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Até:</span>
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[140px]" />
        </div>

        <Input type="number" placeholder="Valor mín" value={filterValueMin} onChange={e => setFilterValueMin(e.target.value)} className="w-[110px]" />
        <Input type="number" placeholder="Valor máx" value={filterValueMax} onChange={e => setFilterValueMax(e.target.value)} className="w-[110px]" />

        {/* Column customization */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" />Colunas</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {ALL_COLUMNS.map(col => (
              <DropdownMenuCheckboxItem key={col} checked={visibleColumns.has(col)} onCheckedChange={() => toggleColumn(col)}>
                {COLUMN_LABELS[col]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetColumns}><RotateCcw className="h-3.5 w-3.5 mr-2" />Restaurar padrão</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-1" />CSV
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Limpar</Button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedDeals.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selectedDeals.size} selecionada(s)</span>

          {/* Move stage */}
          <Select value={bulkTargetStage} onValueChange={setBulkTargetStage}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mover etapa..." /></SelectTrigger>
            <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkTargetStage || bulkMoving} onClick={handleBulkMove}>
            <MoveRight className="h-4 w-4 mr-1" />{bulkMoving ? 'Movendo...' : 'Mover'}
          </Button>

          {/* Assign owner */}
          <Select value={bulkOwner} onValueChange={setBulkOwner}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Atribuir responsável..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(profiles).map(([id, p]) => (
                <SelectItem key={id} value={id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkOwner || bulkAssigning} onClick={handleBulkAssignOwner}>
            <UserPlus className="h-4 w-4 mr-1" />{bulkAssigning ? 'Atribuindo...' : 'Atribuir'}
          </Button>

          {/* Change status */}
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mudar status..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="won">Ganha</SelectItem>
              <SelectItem value="lost">Perdida</SelectItem>
              <SelectItem value="reopen">Reabrir</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkStatus || bulkChangingStatus} onClick={handleBulkChangeStatus}>
            {bulkChangingStatus ? 'Alterando...' : 'Aplicar'}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => { setSelectedDeals(new Set()); setBulkTargetStage(''); setBulkOwner(''); setBulkStatus(''); }}>
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
                <Checkbox checked={paginatedDeals.length > 0 && selectedDeals.size === paginatedDeals.length} onCheckedChange={toggleAll} />
              </TableHead>
              {isCol('name') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                  <span className="flex items-center">Negociação <SortIcon col="name" /></span>
                </TableHead>
              )}
              {isCol('owner') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('owner')}>
                  <span className="flex items-center">Responsável <SortIcon col="owner" /></span>
                </TableHead>
              )}
              {isCol('lead_score') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('lead_score')}>
                  <span className="flex items-center">Qualificação <SortIcon col="lead_score" /></span>
                </TableHead>
              )}
              {isCol('stage') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('stage')}>
                  <span className="flex items-center">Etapa <SortIcon col="stage" /></span>
                </TableHead>
              )}
              {isCol('value') && (
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('value')}>
                  <span className="flex items-center justify-end">Valor <SortIcon col="value" /></span>
                </TableHead>
              )}
              {isCol('created_at') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                  <span className="flex items-center">Criação <SortIcon col="created_at" /></span>
                </TableHead>
              )}
              {isCol('status') && (
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                  <span className="flex items-center">Status <SortIcon col="status" /></span>
                </TableHead>
              )}
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                  Nenhuma negociação encontrada
                </TableCell>
              </TableRow>
            ) : (
              paginatedDeals.map(deal => {
                const stage = stages.find(s => s.id === deal.stage_id);
                const status = getDealStatus(deal);
                const ownerName = deal.owner_id ? profiles[deal.owner_id]?.full_name : null;

                return (
                  <TableRow key={deal.id} data-state={selectedDeals.has(deal.id) ? 'selected' : undefined}>
                    <TableCell><Checkbox checked={selectedDeals.has(deal.id)} onCheckedChange={() => toggleDeal(deal.id)} /></TableCell>
                    {isCol('name') && (
                      <TableCell>
                        <div>
                          <span className="font-medium">{deal.name}</span>
                          {deal.contact && <p className="text-xs text-muted-foreground">{deal.contact.name}</p>}
                        </div>
                      </TableCell>
                    )}
                    {isCol('owner') && (
                      <TableCell className="text-sm">{ownerName || <span className="text-muted-foreground">—</span>}</TableCell>
                    )}
                    {isCol('lead_score') && (
                      <TableCell>
                        {deal.contact?.lead_score != null && deal.contact.lead_score > 0
                          ? <Badge variant="outline" className="font-mono">{deal.contact.lead_score}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    )}
                    {isCol('stage') && (
                      <TableCell><Badge variant="secondary" className="whitespace-nowrap">{stage?.name || '—'}</Badge></TableCell>
                    )}
                    {isCol('value') && (
                      <TableCell className="text-right font-medium tabular-nums">{deal.value > 0 ? formatCurrency(deal.value) : '—'}</TableCell>
                    )}
                    {isCol('created_at') && (
                      <TableCell className="text-sm tabular-nums">{format(new Date(deal.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    )}
                    {isCol('status') && (
                      <TableCell><Badge variant={getStatusBadgeVariant(status)}>{status}</Badge></TableCell>
                    )}
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

      {/* Footer: pagination + summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>{filteredAndSorted.length} negociação(ões)</span>
          <span>Total: {formatCurrency(filteredAndSorted.reduce((sum, d) => sum + (d.value || 0), 0))}</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs">por página</span>

          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
