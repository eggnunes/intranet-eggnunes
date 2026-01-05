import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { AlertTriangle, TrendingUp, Loader2, Bell } from 'lucide-react';

interface Anomalia {
  id: string;
  tipo: 'despesa_alta' | 'categoria_estourada' | 'variacao_mensal';
  categoria: string;
  valorAtual: number;
  mediaHistorica: number;
  percentualAcima: number;
  data: string;
  descricao: string;
}

export function AlertasAnomalias() {
  const [loading, setLoading] = useState(true);
  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);

  useEffect(() => {
    detectarAnomalias();
  }, []);

  const detectarAnomalias = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const mesAtualInicio = startOfMonth(hoje);
      const mesAtualFim = endOfMonth(hoje);
      
      // Buscar histórico dos últimos 6 meses
      const historico: { [categoria: string]: number[] } = {};
      
      for (let i = 1; i <= 6; i++) {
        const mesInicio = startOfMonth(subMonths(hoje, i));
        const mesFim = endOfMonth(subMonths(hoje, i));
        
        const { data } = await supabase
          .from('fin_lancamentos')
          .select('categoria_id, valor, tipo')
          .gte('data_lancamento', format(mesInicio, 'yyyy-MM-dd'))
          .lte('data_lancamento', format(mesFim, 'yyyy-MM-dd'))
          .eq('tipo', 'despesa')
          .eq('status', 'pago')
          .is('deleted_at', null);

        data?.forEach(l => {
          if (l.categoria_id) {
            if (!historico[l.categoria_id]) {
              historico[l.categoria_id] = [];
            }
            historico[l.categoria_id][i - 1] = (historico[l.categoria_id][i - 1] || 0) + Number(l.valor);
          }
        });
      }

      // Buscar despesas do mês atual com categorias
      const { data: despesasAtuais } = await supabase
        .from('fin_lancamentos')
        .select(`
          id,
          categoria_id,
          valor,
          data_lancamento,
          descricao,
          categoria:fin_categorias(nome)
        `)
        .gte('data_lancamento', format(mesAtualInicio, 'yyyy-MM-dd'))
        .lte('data_lancamento', format(mesAtualFim, 'yyyy-MM-dd'))
        .eq('tipo', 'despesa')
        .eq('status', 'pago')
        .is('deleted_at', null);

      // Agrupar despesas atuais por categoria
      const despesasPorCategoria: { [id: string]: { total: number; nome: string; lancamentos: any[] } } = {};
      
      despesasAtuais?.forEach(d => {
        if (d.categoria_id) {
          if (!despesasPorCategoria[d.categoria_id]) {
            despesasPorCategoria[d.categoria_id] = {
              total: 0,
              nome: (d.categoria as any)?.nome || 'Sem categoria',
              lancamentos: []
            };
          }
          despesasPorCategoria[d.categoria_id].total += Number(d.valor);
          despesasPorCategoria[d.categoria_id].lancamentos.push(d);
        }
      });

      const anomaliasDetectadas: Anomalia[] = [];

      // Detectar anomalias por categoria
      Object.entries(despesasPorCategoria).forEach(([catId, dados]) => {
        const historicoCategoria = historico[catId] || [];
        if (historicoCategoria.length < 3) return; // Precisa de pelo menos 3 meses de histórico

        const media = historicoCategoria.reduce((a, b) => a + (b || 0), 0) / historicoCategoria.length;
        const desvio = Math.sqrt(
          historicoCategoria.reduce((acc, val) => acc + Math.pow((val || 0) - media, 2), 0) / historicoCategoria.length
        );

        // Limite: média + 2 desvios padrão
        const limite = media + (desvio * 2);

        if (dados.total > limite && dados.total > media * 1.5) {
          const percentualAcima = ((dados.total - media) / media) * 100;
          
          anomaliasDetectadas.push({
            id: catId,
            tipo: 'categoria_estourada',
            categoria: dados.nome,
            valorAtual: dados.total,
            mediaHistorica: media,
            percentualAcima,
            data: format(hoje, 'yyyy-MM-dd'),
            descricao: `Categoria "${dados.nome}" está ${percentualAcima.toFixed(0)}% acima da média histórica`
          });
        }

        // Detectar lançamentos individuais anômalos (> 3x a média por lançamento)
        const mediaLancamento = media / 10; // Assumindo ~10 lançamentos por mês
        dados.lancamentos.forEach(l => {
          if (Number(l.valor) > mediaLancamento * 3 && Number(l.valor) > 500) {
            anomaliasDetectadas.push({
              id: l.id,
              tipo: 'despesa_alta',
              categoria: dados.nome,
              valorAtual: Number(l.valor),
              mediaHistorica: mediaLancamento,
              percentualAcima: ((Number(l.valor) - mediaLancamento) / mediaLancamento) * 100,
              data: l.data_lancamento,
              descricao: `"${l.descricao}" - valor atípico para a categoria`
            });
          }
        });
      });

      // Ordenar por percentual acima da média
      anomaliasDetectadas.sort((a, b) => b.percentualAcima - a.percentualAcima);
      setAnomalias(anomaliasDetectadas.slice(0, 10)); // Top 10 anomalias
    } catch (error) {
      console.error('Erro ao detectar anomalias:', error);
      toast.error('Erro ao analisar anomalias');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alertas de Anomalias
        </CardTitle>
        <CardDescription>Despesas que ultrapassam a média histórica</CardDescription>
      </CardHeader>
      <CardContent>
        {anomalias.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma anomalia detectada</p>
            <p className="text-sm">Suas despesas estão dentro da média histórica</p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomalias.map((anomalia) => (
              <div 
                key={anomalia.id} 
                className="flex items-start gap-3 p-3 border rounded-lg bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
              >
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{anomalia.categoria}</span>
                    <Badge variant="secondary">
                      +{anomalia.percentualAcima.toFixed(0)}% acima da média
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{anomalia.descricao}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>Atual: <strong className="text-red-600">{formatCurrency(anomalia.valorAtual)}</strong></span>
                    <span>Média: <strong>{formatCurrency(anomalia.mediaHistorica)}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
