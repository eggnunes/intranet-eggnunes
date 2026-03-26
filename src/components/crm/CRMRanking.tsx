import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Phone, CalendarCheck, Trophy, Percent, FileCheck, ChevronDown, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Criteria = 'calls' | 'meetings' | 'closings' | 'conversion';

interface SellerStats {
  ownerId: string;
  name: string;
  calls: number;
  meetings: number;
  closings: number;
  totalDeals: number;
  conversion: number;
}

interface DealDetail {
  id: string;
  name: string;
  value: number | null;
  closedAt: string | null;
  contactName: string | null;
  productName: string | null;
}

const CRITERIA_CONFIG: Record<Criteria, { label: string; icon: typeof Phone; suffix: string }> = {
  calls: { label: 'Chamados', icon: Phone, suffix: '' },
  meetings: { label: 'Agendamentos', icon: CalendarCheck, suffix: '' },
  closings: { label: 'Fechamentos', icon: Trophy, suffix: '' },
  conversion: { label: 'Conversão', icon: Percent, suffix: '%' },
};

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BORDERS = [
  'border-yellow-400 shadow-yellow-400/20',
  'border-gray-400 shadow-gray-400/20',
  'border-amber-600 shadow-amber-600/20',
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(330, 81%, 60%)',
  'hsl(160, 60%, 45%)',
];



const EXCLUDED_NAMES = ['rafael egg'];

function getBusinessCyclePeriodWithOffset(offset: number): { start: string; end: string; startDate: Date; endDate: Date } {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  let baseMonth: number;
  if (day >= 25) {
    baseMonth = month;
  } else {
    baseMonth = month - 1;
  }

  const adjustedMonth = baseMonth + offset;
  const startDate = new Date(year, adjustedMonth, 25);
  const endDate = new Date(year, adjustedMonth + 1, 24, 23, 59, 59);

  const toISO = (d: Date) => d.toISOString().split('T')[0];
  return { start: toISO(startDate), end: toISO(endDate), startDate, endDate };
}

const PERIOD_OPTIONS = [
  { value: '0', label: 'Período Atual' },
  { value: '-1', label: 'Período Anterior' },
  { value: '-2', label: '2 períodos atrás' },
  { value: '-3', label: '3 períodos atrás' },
  { value: '-4', label: '4 períodos atrás' },
  { value: '-5', label: '5 períodos atrás' },
];

export const CRMRanking = () => {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [dealsByOwner, setDealsByOwner] = useState<Map<string, DealDetail[]>>(new Map());
  const [allWonDeals, setAllWonDeals] = useState<(DealDetail & { ownerName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criteria>('closings');
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);

  const period = useMemo(() => getBusinessCyclePeriodWithOffset(selectedOffset), [selectedOffset]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setExpandedSellerId(null);
    try {
      const [dealsRes, activitiesRes, profilesRes, contactsRes] = await Promise.all([
        supabase
          .from('crm_deals')
          .select('id, name, value, owner_id, won, closed_at, contact_id, product_name')
          .gte('closed_at', period.start)
          .lte('closed_at', period.end),
        supabase
          .from('crm_activities')
          .select('owner_id, type')
          .gte('created_at', period.start)
          .lte('created_at', period.end + 'T23:59:59'),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('crm_contacts').select('id, name'),
      ]);

      const deals = dealsRes.data || [];
      const activities = activitiesRes.data || [];
      const profiles = (profilesRes.data || []).filter(
        p => !EXCLUDED_NAMES.some(ex => (p.full_name || '').toLowerCase().includes(ex))
      );
      const contacts = contactsRes.data || [];

      const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Sem nome']));
      const contactMap = new Map(contacts.map(c => [c.id, c.name]));
      const allowedIds = new Set(profiles.map(p => p.id));

      const ownerIds = new Set<string>();
      deals.forEach(d => d.owner_id && allowedIds.has(d.owner_id) && ownerIds.add(d.owner_id));
      activities.forEach(a => a.owner_id && allowedIds.has(a.owner_id) && ownerIds.add(a.owner_id));

      const statsMap = new Map<string, SellerStats>();
      const dealsMap = new Map<string, DealDetail[]>();
      const wonDealsAll: (DealDetail & { ownerName: string })[] = [];

      ownerIds.forEach(id => {
        statsMap.set(id, {
          ownerId: id,
          name: profileMap.get(id) || id.substring(0, 8),
          calls: 0, meetings: 0, closings: 0, totalDeals: 0, conversion: 0,
        });
        dealsMap.set(id, []);
      });

      deals.forEach(d => {
        if (!d.owner_id) return;
        const s = statsMap.get(d.owner_id);
        if (!s) return;
        s.totalDeals++;
        if (d.won === true) {
          s.closings++;
          const detail: DealDetail = {
            id: d.id,
            name: d.name,
            value: d.value,
            closedAt: d.closed_at,
            contactName: (d.contact_id ? contactMap.get(d.contact_id) : null) || d.name || null,
            productName: d.product_name || d.name,
          };
          dealsMap.get(d.owner_id)?.push(detail);
          wonDealsAll.push({ ...detail, ownerName: s.name });
        }
      });

      activities.forEach(a => {
        if (!a.owner_id) return;
        const s = statsMap.get(a.owner_id);
        if (!s) return;
        if (a.type === 'call') s.calls++;
        if (a.type === 'meeting') s.meetings++;
      });

      statsMap.forEach(s => {
        s.conversion = s.totalDeals > 0 ? Math.round((s.closings / s.totalDeals) * 100) : 0;
      });

      setSellers(Array.from(statsMap.values()));
      setDealsByOwner(dealsMap);
      setAllWonDeals(wonDealsAll);
    } catch (err) {
      console.error('Error fetching ranking data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = useMemo(() => {
    return [...sellers].sort((a, b) => b[criteria] - a[criteria]).slice(0, 10);
  }, [sellers, criteria]);

  const totalClosings = useMemo(() => sellers.reduce((acc, s) => acc + s.closings, 0), [sellers]);

  // Chart data: closings per seller
  const sellerChartData = useMemo(() => {
    return [...sellers]
      .filter(s => s.closings > 0)
      .sort((a, b) => b.closings - a.closings)
      .map(s => ({
        name: s.name.split(' ')[0],
        fullName: s.name,
        contratos: s.closings,
      }));
  }, [sellers]);


  const periodLabel = `${format(period.startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(period.endDate, 'dd/MM/yyyy', { locale: ptBR })}`;

  const formatCurrency = (value: number | null) => {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Vendedores
              </CardTitle>
              <CardDescription className="mt-1">Período: {periodLabel}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={String(selectedOffset)} onValueChange={(v) => setSelectedOffset(Number(v))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="flex items-center gap-1.5 text-sm px-3 py-1.5 whitespace-nowrap">
                <FileCheck className="h-4 w-4" />
                {totalClosings} contrato{totalClosings !== 1 ? 's' : ''} fechado{totalClosings !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CRITERIA_CONFIG) as Criteria[]).map(key => {
              const cfg = CRITERIA_CONFIG[key];
              const Icon = cfg.icon;
              return (
                <Button key={key} variant={criteria === key ? 'default' : 'outline'} size="sm" onClick={() => setCriteria(key)}>
                  <Icon className="h-4 w-4 mr-1" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>

          {sorted.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado no período.</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sorted.map((seller, idx) => {
                  const isTop3 = idx < 3;
                  const value = seller[criteria];
                  const suffix = CRITERIA_CONFIG[criteria].suffix;
                  const sellerDeals = dealsByOwner.get(seller.ownerId) || [];
                  const isExpanded = expandedSellerId === seller.ownerId;

                  return (
                    <motion.div key={seller.ownerId} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                      <Collapsible open={isExpanded} onOpenChange={() => setExpandedSellerId(isExpanded ? null : seller.ownerId)}>
                        <CollapsibleTrigger asChild>
                          <div className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors cursor-pointer hover:bg-muted/30 ${isTop3 ? `${MEDAL_BORDERS[idx]} shadow-md bg-card` : 'border-border bg-card'}`}>
                            <div className="flex-shrink-0 w-10 text-center">
                              {isTop3 ? <span className="text-2xl">{MEDALS[idx]}</span> : <span className="text-lg font-bold text-muted-foreground">{idx + 1}º</span>}
                            </div>
                            <Avatar className={isTop3 ? 'h-12 w-12' : 'h-10 w-10'}>
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {seller.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${isTop3 ? 'text-lg' : ''}`}>{seller.name}</p>
                              {sellerDeals.length > 0 && (
                                <p className="text-xs text-muted-foreground">{sellerDeals.length} contrato{sellerDeals.length !== 1 ? 's' : ''} — clique para detalhes</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`font-bold ${isTop3 ? 'text-2xl text-primary' : 'text-xl text-muted-foreground'}`}>{value}{suffix}</span>
                              {sellerDeals.length > 0 && (
                                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        {sellerDeals.length > 0 && (
                          <CollapsibleContent>
                            <div className="mt-1 ml-14 mr-2 mb-2 rounded-lg border bg-muted/20 overflow-hidden">
                              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                                <span>Cliente</span>
                                <span>Produto / Ação</span>
                                <span className="text-right">Valor</span>
                                <span className="text-right">Fechamento</span>
                              </div>
                              {sellerDeals.map(deal => (
                                <div key={deal.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 px-4 py-2.5 text-sm border-b last:border-b-0 hover:bg-muted/30">
                                  <span className="truncate font-medium">{deal.contactName || 'Sem contato'}</span>
                                  <span className="truncate text-muted-foreground">{deal.productName}</span>
                                  <span className="text-right whitespace-nowrap font-medium">{formatCurrency(deal.value)}</span>
                                  <span className="text-right whitespace-nowrap text-muted-foreground">
                                    {deal.closedAt ? format(new Date(deal.closedAt), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart - closings per seller */}
      {totalClosings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Fechamentos por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sellerChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`${value} contrato${value !== 1 ? 's' : ''}`, 'Fechamentos']}
                  labelFormatter={(label: string) => {
                    const item = sellerChartData.find(s => s.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="contratos" radius={[4, 4, 0, 0]}>
                  {sellerChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
