import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Wallet, Users, TrendingUp, Settings, Save } from 'lucide-react';
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

interface SellerCommission {
  ownerId: string;
  name: string;
  contracts: number;
  commission: number;
}

const EXCLUDED_NAMES = ['rafael egg'];

function getBusinessCyclePeriod() {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  let startDate: Date;
  let endDate: Date;

  if (day >= 25) {
    startDate = new Date(year, month, 25);
    endDate = new Date(year, month + 1, 24, 23, 59, 59);
  } else {
    startDate = new Date(year, month - 1, 25);
    endDate = new Date(year, month, 24, 23, 59, 59);
  }

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const CRMCommissions = () => {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [sellers, setSellers] = useState<SellerCommission[]>([]);
  const [editRules, setEditRules] = useState<CommissionRule[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const period = useMemo(() => getBusinessCyclePeriod(), []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, dealsRes, profilesRes] = await Promise.all([
        supabase.from('crm_commission_rules').select('*').order('min_contracts'),
        supabase.from('crm_deals').select('owner_id, won, closed_at').eq('won', true).gte('closed_at', period.start).lte('closed_at', period.end),
        supabase.from('profiles').select('id, full_name'),
      ]);

      const fetchedRules = (rulesRes.data || []) as CommissionRule[];
      setRules(fetchedRules);
      setEditRules(fetchedRules.map(r => ({ ...r })));

      const profiles = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));
      const ownerMap = new Map<string, number>();

      for (const deal of dealsRes.data || []) {
        if (!deal.owner_id) continue;
        const name = profiles.get(deal.owner_id) || '';
        if (EXCLUDED_NAMES.includes(name.toLowerCase())) continue;
        ownerMap.set(deal.owner_id, (ownerMap.get(deal.owner_id) || 0) + 1);
      }

      const totalContracts = Array.from(ownerMap.values()).reduce((s, v) => s + v, 0);
      const activeRule = getActiveRule(fetchedRules, totalContracts);
      const valuePerContract = activeRule?.value_per_contract || 0;

      const sellerList: SellerCommission[] = Array.from(ownerMap.entries())
        .map(([ownerId, contracts]) => ({
          ownerId,
          name: profiles.get(ownerId) || 'Desconhecido',
          contracts,
          commission: contracts * valuePerContract,
        }))
        .sort((a, b) => b.contracts - a.contracts);

      setSellers(sellerList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Period info */}
      <p className="text-sm text-muted-foreground">Período: {periodLabel}</p>

      {/* Seller table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comissão por Vendedor</CardTitle>
          <CardDescription>Baseado em {totalContracts} contratos da equipe</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Contratos</TableHead>
                <TableHead className="text-center">Valor/Contrato</TableHead>
                <TableHead className="text-right">Comissão Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum contrato fechado no período
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((s) => (
                  <TableRow key={s.ownerId}>
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
                  </TableRow>
                ))
              )}
              {sellers.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{totalContracts}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(sellers.reduce((s, v) => s + v.commission, 0))}
                  </TableCell>
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
