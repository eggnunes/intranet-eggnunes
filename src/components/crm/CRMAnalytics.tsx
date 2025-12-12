import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Clock, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StageAnalytics {
  stageId: string;
  stageName: string;
  avgDays: number;
  dealCount: number;
  totalValue: number;
}

interface LostDealReason {
  reason: string;
  count: number;
  percentage: number;
}

export const CRMAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stageAnalytics, setStageAnalytics] = useState<StageAnalytics[]>([]);
  const [lostReasons, setLostReasons] = useState<LostDealReason[]>([]);
  const [totalLostDeals, setTotalLostDeals] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch stages
      const { data: stages } = await supabase
        .from('crm_deal_stages')
        .select('*')
        .order('order_index');

      // Fetch deal history for time calculations
      const { data: dealHistory } = await supabase
        .from('crm_deal_history')
        .select('*')
        .order('created_at');

      // Fetch deals for lost reasons
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('*');

      if (stages && dealHistory && deals) {
        // Calculate average time per stage
        const stageStats: Record<string, { totalDays: number; count: number; value: number }> = {};
        
        stages.forEach(stage => {
          stageStats[stage.id] = { totalDays: 0, count: 0, value: 0 };
        });

        // Group history by deal
        const dealHistoryByDeal: Record<string, typeof dealHistory> = {};
        dealHistory.forEach(h => {
          if (h.deal_id) {
            if (!dealHistoryByDeal[h.deal_id]) dealHistoryByDeal[h.deal_id] = [];
            dealHistoryByDeal[h.deal_id].push(h);
          }
        });

        // Calculate time in each stage
        Object.entries(dealHistoryByDeal).forEach(([dealId, history]) => {
          const sortedHistory = history.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          for (let i = 0; i < sortedHistory.length - 1; i++) {
            const current = sortedHistory[i];
            const next = sortedHistory[i + 1];
            if (current.to_stage_id) {
              const daysInStage = Math.ceil(
                (new Date(next.created_at).getTime() - new Date(current.created_at).getTime()) 
                / (1000 * 60 * 60 * 24)
              );
              if (stageStats[current.to_stage_id]) {
                stageStats[current.to_stage_id].totalDays += daysInStage;
                stageStats[current.to_stage_id].count++;
              }
            }
          }
        });

        // Add current deals in stages
        deals.forEach(deal => {
          if (deal.stage_id && stageStats[deal.stage_id]) {
            stageStats[deal.stage_id].value += Number(deal.value) || 0;
            if (!deal.closed_at) {
              const daysInStage = Math.ceil(
                (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              stageStats[deal.stage_id].totalDays += daysInStage;
              stageStats[deal.stage_id].count++;
            }
          }
        });

        const analytics: StageAnalytics[] = stages.map(stage => ({
          stageId: stage.id,
          stageName: stage.name,
          avgDays: stageStats[stage.id].count > 0 
            ? Math.round(stageStats[stage.id].totalDays / stageStats[stage.id].count)
            : 0,
          dealCount: stageStats[stage.id].count,
          totalValue: stageStats[stage.id].value,
        }));

        setStageAnalytics(analytics);

        // Calculate lost deal reasons
        const lostDeals = deals.filter(d => d.won === false && d.closed_at);
        setTotalLostDeals(lostDeals.length);

        const reasonCounts: Record<string, number> = {};
        lostDeals.forEach(deal => {
          const reason = deal.loss_reason || 'Não informado';
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });

        const reasons: LostDealReason[] = Object.entries(reasonCounts)
          .map(([reason, count]) => ({
            reason,
            count,
            percentage: lostDeals.length > 0 ? (count / lostDeals.length) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count);

        setLostReasons(reasons);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const maxDays = Math.max(...stageAnalytics.map(s => s.avgDays), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tempo médio em cada etapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tempo Médio por Etapa do Pipeline
          </CardTitle>
          <CardDescription>
            Análise de quanto tempo os deals passam em cada etapa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stageAnalytics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Não há dados suficientes para análise
            </p>
          ) : (
            <div className="space-y-4">
              {stageAnalytics.map((stage) => (
                <div key={stage.stageId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stage.stageName}</span>
                      <Badge variant="outline" className="text-xs">
                        {stage.dealCount} deals
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(stage.totalValue)}
                      </span>
                      <span className="font-semibold text-primary">
                        {stage.avgDays} dias
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={(stage.avgDays / maxDays) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatório de deals perdidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Análise de Deals Perdidos
          </CardTitle>
          <CardDescription>
            Motivos mais comuns de perda ({totalLostDeals} deals perdidos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lostReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum deal perdido registrado
            </p>
          ) : (
            <div className="space-y-4">
              {lostReasons.map((reason, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{reason.reason}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="destructive" className="text-xs">
                        {reason.count} deals
                      </Badge>
                      <span className="text-muted-foreground">
                        {reason.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={reason.percentage} 
                    className="h-2 [&>div]:bg-red-500"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tempo Médio Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stageAnalytics.reduce((sum, s) => sum + s.avgDays, 0)} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Etapa Mais Longa</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stageAnalytics.length > 0 
                ? stageAnalytics.reduce((max, s) => s.avgDays > max.avgDays ? s : max).stageName
                : '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Taxa de Perda</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {totalLostDeals}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Principal Motivo</span>
            </div>
            <p className="text-lg font-bold mt-1 truncate">
              {lostReasons.length > 0 ? lostReasons[0].reason : '-'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
