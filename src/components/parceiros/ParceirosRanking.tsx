import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Trophy, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface ParceiroRanking {
  id: string;
  nome_completo: string;
  nome_escritorio: string | null;
  ranking: number;
  tipo: string;
  total_indicacoes: number;
  valor_total_receber: number;
  valor_total_pagar: number;
}

export function ParceirosRanking() {
  const [parceiros, setParceiros] = useState<ParceiroRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      // Buscar parceiros ativos com suas indicações e pagamentos
      const { data: parceirosData, error: parceirosError } = await supabase
        .from('parceiros')
        .select('id, nome_completo, nome_escritorio, ranking, tipo')
        .eq('ativo', true)
        .order('ranking', { ascending: false });

      if (parceirosError) throw parceirosError;

      // Para cada parceiro, buscar estatísticas
      const parceirosComStats = await Promise.all((parceirosData || []).map(async (p) => {
        // Buscar total de indicações
        const { count: totalIndicacoes } = await supabase
          .from('parceiros_indicacoes')
          .select('*', { count: 'exact', head: true })
          .eq('parceiro_id', p.id);

        // Buscar valor a receber
        const { data: receber } = await supabase
          .from('parceiros_pagamentos')
          .select('valor')
          .eq('parceiro_id', p.id)
          .eq('tipo', 'receber')
          .eq('status', 'pendente');

        // Buscar valor a pagar
        const { data: pagar } = await supabase
          .from('parceiros_pagamentos')
          .select('valor')
          .eq('parceiro_id', p.id)
          .eq('tipo', 'pagar')
          .eq('status', 'pendente');

        return {
          ...p,
          total_indicacoes: totalIndicacoes || 0,
          valor_total_receber: receber?.reduce((acc, r) => acc + r.valor, 0) || 0,
          valor_total_pagar: pagar?.reduce((acc, r) => acc + r.valor, 0) || 0
        };
      }));

      // Ordenar por ranking e depois por indicações
      parceirosComStats.sort((a, b) => {
        if (b.ranking !== a.ranking) return b.ranking - a.ranking;
        return b.total_indicacoes - a.total_indicacoes;
      });

      setParceiros(parceirosComStats);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
      toast.error('Erro ao carregar ranking');
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

  const renderStars = (ranking: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= ranking ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );

  const getTrophyIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1:
        return <Trophy className="h-6 w-6 text-gray-400" />;
      case 2:
        return <Trophy className="h-6 w-6 text-amber-700" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">{position + 1}º</span>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Parceiros
        </CardTitle>
        <CardDescription>
          Melhores parceiros ordenados por avaliação e volume de indicações
        </CardDescription>
      </CardHeader>
      <CardContent>
        {parceiros.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum parceiro ativo cadastrado
          </p>
        ) : (
          <div className="space-y-4">
            {parceiros.slice(0, 10).map((parceiro, index) => (
              <div
                key={parceiro.id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  index === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800' :
                  index === 1 ? 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-700' :
                  index === 2 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
                  'bg-card'
                }`}
              >
                <div className="flex-shrink-0">
                  {getTrophyIcon(index)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold truncate">{parceiro.nome_completo}</h4>
                    {renderStars(parceiro.ranking)}
                  </div>
                  {parceiro.nome_escritorio && (
                    <p className="text-sm text-muted-foreground truncate">{parceiro.nome_escritorio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="outline">
                      {parceiro.total_indicacoes} indicação(ões)
                    </Badge>
                    <Badge variant="outline" className={parceiro.tipo === 'indicamos' ? 'border-blue-500 text-blue-600' : parceiro.tipo === 'nos_indicam' ? 'border-purple-500 text-purple-600' : 'border-green-500 text-green-600'}>
                      {parceiro.tipo === 'indicamos' ? 'Indicamos' : parceiro.tipo === 'nos_indicam' ? 'Nos Indicam' : 'Ambos'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-sm">
                  {parceiro.valor_total_receber > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <ArrowUpCircle className="h-4 w-4" />
                      {formatCurrency(parceiro.valor_total_receber)}
                    </div>
                  )}
                  {parceiro.valor_total_pagar > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <ArrowDownCircle className="h-4 w-4" />
                      {formatCurrency(parceiro.valor_total_pagar)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
