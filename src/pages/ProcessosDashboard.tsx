import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Briefcase, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Lawsuit {
  id: string;
  number: string;
  parties: string;
  court: string;
  status: string;
}

interface Movement {
  id: string;
  date: string;
  description: string;
  lawsuit_number: string;
}

export default function ProcessosDashboard() {
  const [lawsuits, setLawsuits] = useState<Lawsuit[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lawsuitsRes, movementsRes] = await Promise.all([
        supabase.functions.invoke('advbox-integration/lawsuits'),
        supabase.functions.invoke('advbox-integration/last-movements'),
      ]);

      if (lawsuitsRes.error) throw lawsuitsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setLawsuits(lawsuitsRes.data || []);
      setMovements(movementsRes.data || []);
    } catch (error) {
      console.error('Error fetching Advbox data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do Advbox.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando processos...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            Dashboard de Processos
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe seus processos e movimentações em tempo real
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Estatísticas */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Visão Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-3xl font-bold text-primary">{lawsuits.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Processos Ativos</div>
                </div>
                <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{movements.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Movimentações Recentes</div>
                </div>
                <div className="text-center p-4 bg-orange-500/5 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">
                    {movements.filter(m => {
                      const date = new Date(m.date);
                      const today = new Date();
                      const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays <= 7;
                    }).length}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Alertas (Últimos 7 dias)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processos Ativos */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Processos Ativos</CardTitle>
              <CardDescription>Seus processos em andamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {lawsuits.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum processo encontrado
                    </p>
                  ) : (
                    lawsuits.map((lawsuit) => (
                      <Card key={lawsuit.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-sm mb-1">{lawsuit.number}</p>
                              <p className="text-xs text-muted-foreground mb-2">{lawsuit.parties}</p>
                              <p className="text-xs text-muted-foreground">{lawsuit.court}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {lawsuit.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Movimentações Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Movimentações Recentes
              </CardTitle>
              <CardDescription>Últimas atualizações dos processos</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma movimentação encontrada
                    </p>
                  ) : (
                    movements.map((movement) => (
                      <div key={movement.id} className="border-l-2 border-primary/30 pl-3 pb-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {new Date(movement.date).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{movement.lawsuit_number}</p>
                        <p className="text-sm">{movement.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
