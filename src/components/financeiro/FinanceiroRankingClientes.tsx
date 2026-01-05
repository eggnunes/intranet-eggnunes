import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, TrendingUp, Crown, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ClienteRanking {
  cliente_id: string;
  cliente_nome: string;
  receita: number;
  despesa: number;
  lucro: number;
  margem: number;
  posicao: number;
}

export function FinanceiroRankingClientes() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<ClienteRanking[]>([]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [criterio, setCriterio] = useState<'receita' | 'lucro' | 'margem'>('receita');

  useEffect(() => {
    fetchRanking();
  }, [ano, criterio]);

  async function fetchRanking() {
    setLoading(true);

    const startDate = `${ano}-01-01`;
    const endDate = `${ano}-12-31`;

    const { data: lancamentos } = await supabase
      .from('fin_lancamentos')
      .select('tipo, valor, cliente_id')
      .gte('data_vencimento', startDate)
      .lte('data_vencimento', endDate)
      .eq('status', 'pago')
      .is('deleted_at', null)
      .not('cliente_id', 'is', null);

    // Buscar clientes
    const { data: clientesData } = await supabase
      .from('fin_clientes')
      .select('id, nome');

    const clientesMap: Record<string, string> = {};
    (clientesData || []).forEach(c => { clientesMap[c.id] = c.nome; });

    // Agrupar por cliente
    const clientes: Record<string, { nome: string; receita: number; despesa: number }> = {};
    
    (lancamentos || []).forEach((l: { tipo: string; valor: number; cliente_id: string }) => {
      if (!l.cliente_id) return;
      if (!clientes[l.cliente_id]) {
        clientes[l.cliente_id] = { nome: clientesMap[l.cliente_id] || 'Cliente sem nome', receita: 0, despesa: 0 };
      }
      if (l.tipo === 'receita') clientes[l.cliente_id].receita += Number(l.valor);
      else if (l.tipo === 'despesa') clientes[l.cliente_id].despesa += Number(l.valor);
    });

    // Calcular métricas e ordenar
    let rankingData: ClienteRanking[] = Object.entries(clientes).map(([id, dados]) => {
      const lucro = dados.receita - dados.despesa;
      const margem = dados.receita > 0 ? (lucro / dados.receita) * 100 : 0;
      return {
        cliente_id: id,
        cliente_nome: dados.nome,
        receita: dados.receita,
        despesa: dados.despesa,
        lucro,
        margem,
        posicao: 0
      };
    });

    // Ordenar pelo critério selecionado
    rankingData.sort((a, b) => {
      if (criterio === 'receita') return b.receita - a.receita;
      if (criterio === 'lucro') return b.lucro - a.lucro;
      return b.margem - a.margem;
    });

    // Adicionar posição
    rankingData = rankingData.map((c, i) => ({ ...c, posicao: i + 1 }));

    setRanking(rankingData.slice(0, 10));
    setLoading(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function getPosicaoIcon(posicao: number) {
    if (posicao === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (posicao === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (posicao === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-muted-foreground">{posicao}</span>;
  }

  function getPosicaoBg(posicao: number) {
    if (posicao === 1) return 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-300';
    if (posicao === 2) return 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-gray-300';
    if (posicao === 3) return 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-300';
    return 'bg-background border-border';
  }

  const maxValor = ranking.length > 0 ? Math.max(...ranking.map(c => c[criterio])) : 0;

  // Totais do top 10
  const totalReceita = ranking.reduce((sum, c) => sum + c.receita, 0);
  const totalLucro = ranking.reduce((sum, c) => sum + c.lucro, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Ranking de Clientes
        </h2>
        <div className="flex gap-4">
          <Select value={criterio} onValueChange={(v: 'receita' | 'lucro' | 'margem') => setCriterio(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Por Receita</SelectItem>
              <SelectItem value="lucro">Por Lucro</SelectItem>
              <SelectItem value="margem">Por Margem</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo do Top 10 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceita)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lucro Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalLucro)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clientes no Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ranking.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Clientes por {criterio === 'receita' ? 'Receita' : criterio === 'lucro' ? 'Lucro' : 'Margem'}</CardTitle>
          <CardDescription>Ranking baseado em {ano}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : ranking.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum cliente com lançamentos no período</p>
          ) : (
            <div className="space-y-3">
              {ranking.map(cliente => (
                <div
                  key={cliente.cliente_id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${getPosicaoBg(cliente.posicao)}`}
                >
                  <div className="flex-shrink-0">
                    {getPosicaoIcon(cliente.posicao)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{cliente.cliente_nome}</h3>
                      {cliente.posicao <= 3 && (
                        <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Receita: {formatCurrency(cliente.receita)}</span>
                      <span>Lucro: {formatCurrency(cliente.lucro)}</span>
                      <Badge variant={cliente.margem >= 20 ? 'default' : cliente.margem >= 0 ? 'secondary' : 'destructive'}>
                        {cliente.margem.toFixed(1)}% margem
                      </Badge>
                    </div>
                    <Progress 
                      value={(cliente[criterio] / maxValor) * 100} 
                      className="mt-2 h-2" 
                    />
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-xl font-bold">
                      {criterio === 'margem' 
                        ? `${cliente.margem.toFixed(1)}%` 
                        : formatCurrency(cliente[criterio])}
                    </div>
                    {cliente.posicao > 1 && (
                      <div className="text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        {(((ranking[0][criterio] - cliente[criterio]) / ranking[0][criterio]) * 100).toFixed(0)}% do líder
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
