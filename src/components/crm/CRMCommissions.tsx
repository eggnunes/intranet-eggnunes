import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Wallet, Users, TrendingUp, Settings, Save, ChevronDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommissionRule {
  id: string;
  min_contracts: number;
  max_contracts: number | null;
  value_per_contract: number;
}

interface DealDetail {
  id: string;
  name: string;
  value: number | null;
  closedAt: string | null;
  contactName: string | null;
  productName: string | null;
}

interface SellerCommission {
  ownerId: string;
  name: string;
  contracts: number;
  commission: number;
  deals: DealDetail[];
}

const EXCLUDED_NAMES = ['rafael egg'];

function getBusinessCyclePeriodWithOffset(offset: number) {
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

  return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0], startDate, endDate };
}

function getActiveRule(rules: CommissionRule[], totalContracts: number): CommissionRule | null {
  return rules.find(r =>
    totalContracts >= r.min_contracts &&
    (r.max_contracts === null || totalContracts <= r.max_contracts)
  ) || null;
}

function getNextRule(rules: CommissionRule[], totalContracts: number): CommissionRule | null {
  const sorted = [...rules].sort((a, b) => a.min_contracts - b.min_contracts);
  return sorted.find(r => r.min_contracts > totalContracts) || null;
}

const formatCurrency = (value: number | null) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const PERIOD_OPTIONS = [
  { value: '0', label: 'Período Atual' },
  { value: '-1', label: 'Período Anterior' },
  { value: '-2', label: '2 períodos atrás' },
  { value: '-3', label: '3 períodos atrás' },
  { value: '-4', label: '4 períodos atrás' },
  { value: '-5', label: '5 períodos atrás' },
];

export const CRMCommissions = () => {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [sellers, setSellers] = useState<SellerCommission[]>([]);
  const [editRules, setEditRules] = useState<CommissionRule[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);

  const period = useMemo(() => getBusinessCyclePeriodWithOffset(selectedOffset), [selectedOffset]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setExpandedSellerId(null);
    try {
      const [rulesRes, dealsRes, profilesRes, contactsRes] = await Promise.all([
        supabase.from('crm_commission_rules').select('*').order('min_contracts'),
        supabase.from('crm_deals').select('id, name, value, owner_id, won, closed_at, contact_id, product_name').eq('won', true).gte('closed_at', period.start).lte('closed_at', period.end),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('crm_contacts').select('id, name'),
      ]);

      const fetchedRules = (rulesRes.data || []) as CommissionRule[];
      setRules(fetchedRules);
      setEditRules(fetchedRules.map(r => ({ ...r })));

      const profiles = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));
      const contactMap = new Map((contactsRes.data || []).map(c => [c.id, c.name]));
      const ownerDeals = new Map<string, DealDetail[]>();

      for (const deal of dealsRes.data || []) {
        if (!deal.owner_id) continue;
        const name = profiles.get(deal.owner_id) || '';
        if (EXCLUDED_NAMES.includes(name.toLowerCase())) continue;
        
        if (!ownerDeals.has(deal.owner_id)) {
          ownerDeals.set(deal.owner_id, []);
        }
        ownerDeals.get(deal.owner_id)!.push({
          id: deal.id,
          name: deal.name,
          value: deal.value,
          closedAt: deal.closed_at,
          contactName: deal.name || (deal.contact_id ? contactMap.get(deal.contact_id) : null) || null,
          productName: deal.product_name || deal.name,
        });
      }

      const totalContracts = Array.from(ownerDeals.values()).reduce((s, v) => s + v.length, 0);
      const activeRule = getActiveRule(fetchedRules, totalContracts);
      const valuePerContract = activeRule?.value_per_contract || 0;

      const sellerList: SellerCommission[] = Array.from(ownerDeals.entries())
        .map(([ownerId, deals]) => ({
          ownerId,
          name: profiles.get(ownerId) || 'Desconhecido',
          contracts: deals.length,
          commission: deals.length * valuePerContract,
          deals,
        }))
        .sort((a, b) => b.contracts - a.contracts);

      setSellers(sellerList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalContracts = sellers.reduce((s, v) => s + v.contracts, 0);
  const activeRule = getActiveRule(rules, totalContracts);
  const nextRule = getNextRule(rules, totalContracts);
  const contractsToNext = nextRule ? nextRule.min_contracts - totalContracts : 0;
  const progressToNext = nextRule
    ? ((totalContracts - (activeRule?.min_contracts || 0)) / (nextRule.min_contracts - (activeRule?.min_contracts || 0))) * 100
    : 100;

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      for (const rule of editRules) {
        const { error } = await supabase
          .from('crm_commission_rules')
          .update({
            min_contracts: rule.min_contracts,
            max_contracts: rule.max_contracts,
            value_per_contract: rule.value_per_contract,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rule.id);
        if (error) throw error;
      }
      toast.success('Regras de comissão atualizadas!');
      setEditing(false);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const periodLabel = `${format(period.startDate, "dd/MM", { locale: ptBR })} a ${format(period.endDate, "dd/MM/yyyy", { locale: ptBR })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
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
        <span className="text-sm text-muted-foreground">Período: {periodLabel}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total da Equipe</span>
            </div>
            <p className="text-3xl font-bold">{totalContracts}</p>
            <p className="text-xs text-muted-foreground">contratos no período</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Valor por Contrato</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(activeRule?.value_per_contract || 0)}
            </p>
            <p className="text-xs text-muted-foreground">faixa atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Próxima Faixa</span>
            </div>
            {nextRule ? (
              <>
                <p className="text-lg font-semibold">
                  Faltam <span className="text-primary">{contractsToNext}</span> contratos
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  para {formatCurrency(nextRule.value_per_contract)}/contrato
                </p>
                <Progress value={progressToNext} className="h-2" />
              </>
            ) : (
              <p className="text-lg font-semibold text-green-600">Faixa máxima atingida! 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seller table with expandable deals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comissão por Vendedor</CardTitle>
          <CardDescription>Baseado em {totalContracts} contratos da equipe — clique no vendedor para ver detalhes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Contratos</TableHead>
                <TableHead className="text-center">Valor/Contrato</TableHead>
                <TableHead className="text-right">Comissão Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum contrato fechado no período
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((s) => {
                  const isExpanded = expandedSellerId === s.ownerId;
                  return (
                    <Collapsible key={s.ownerId} open={isExpanded} onOpenChange={() => setExpandedSellerId(isExpanded ? null : s.ownerId)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{s.contracts}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {formatCurrency(activeRule?.value_per_contract || 0)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(s.commission)}
                            </TableCell>
                            <TableCell>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="bg-muted/20 border-t border-b px-6 py-3">
                                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5" />
                                  Contratos fechados por {s.name}
                                </p>
                                <div className="rounded-md border bg-card overflow-hidden">
                                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                                    <span>Cliente</span>
                                    <span>Produto / Ação</span>
                                    <span className="text-right">Valor</span>
                                    <span className="text-right">Fechamento</span>
                                  </div>
                                  {s.deals.map(deal => (
                                    <div key={deal.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-4 px-4 py-2.5 text-sm border-b last:border-b-0">
                                      <span className="truncate font-medium">{deal.contactName || 'Sem contato'}</span>
                                      <span className="truncate text-muted-foreground">{deal.productName}</span>
                                      <span className="text-right whitespace-nowrap font-medium">{formatCurrency(deal.value)}</span>
                                      <span className="text-right whitespace-nowrap text-muted-foreground">
                                        {deal.closedAt ? format(new Date(deal.closedAt), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
              {sellers.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{totalContracts}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(sellers.reduce((s, v) => s + v.commission, 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Faixas de comissão */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Faixas de Comissionamento
            </CardTitle>
            <CardDescription>Regras progressivas com base no total da equipe</CardDescription>
          </div>
          {isAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar Regras
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(editing ? editRules : rules).map((rule, idx) => {
              const isActive = activeRule?.id === rule.id;
              return (
                <Card
                  key={rule.id}
                  className={`${isActive ? 'border-primary bg-primary/5' : ''}`}
                >
                  <CardContent className="pt-4 space-y-3">
                    {isActive && (
                      <Badge className="bg-primary text-primary-foreground text-xs">Faixa Atual</Badge>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Contratos da equipe</p>
                      {editing ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={editRules[idx].min_contracts}
                            onChange={(e) => {
                              const updated = [...editRules];
                              updated[idx].min_contracts = parseInt(e.target.value) || 0;
                              setEditRules(updated);
                            }}
                          />
                          <span>a</span>
                          <Input
                            type="number"
                            className="w-20 h-8"
                            placeholder="∞"
                            value={editRules[idx].max_contracts ?? ''}
                            onChange={(e) => {
                              const updated = [...editRules];
                              updated[idx].max_contracts = e.target.value ? parseInt(e.target.value) : null;
                              setEditRules(updated);
                            }}
                          />
                        </div>
                      ) : (
                        <p className="font-semibold">
                          {rule.min_contracts} a {rule.max_contracts ?? '∞'}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor por contrato</p>
                      {editing ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-32 h-8 mt-1"
                          value={editRules[idx].value_per_contract}
                          onChange={(e) => {
                            const updated = [...editRules];
                            updated[idx].value_per_contract = parseFloat(e.target.value) || 0;
                            setEditRules(updated);
                          }}
                        />
                      ) : (
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(rule.value_per_contract)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {editing && (
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveRules} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => { setEditing(false); setEditRules(rules.map(r => ({ ...r }))); }}>
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
