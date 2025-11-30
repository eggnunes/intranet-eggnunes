import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Search, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Publication {
  id: string;
  date: string;
  description: string;
  lawsuit_number: string;
  court: string;
}

export default function PublicacoesFeed() {
  const [lawsuitNumber, setLawsuitNumber] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [allPublications, setAllPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const { toast } = useToast();

  // Buscar publicações recentes ao carregar a página
  useEffect(() => {
    fetchRecentPublications();
  }, []);

  const fetchRecentPublications = async () => {
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/last-movements');

      if (error) throw error;

      const allPubs = data?.data || [];
      
      // Filtrar publicações da última semana
      const oneWeekAgo = subDays(new Date(), 7);
      const recentPubs = allPubs.filter((pub: any) => {
        try {
          const pubDate = parseISO(pub.date || pub.created_at);
          return isAfter(pubDate, oneWeekAgo);
        } catch {
          return false;
        }
      });

      setAllPublications(recentPubs);
      setPublications(recentPubs);
      
      if (recentPubs.length === 0) {
        toast({
          title: 'Nenhuma publicação recente',
          description: 'Não há publicações nos últimos 7 dias.',
        });
      }
    } catch (error) {
      console.error('Error fetching recent publications:', error);
      toast({
        title: 'Erro ao buscar publicações',
        description: 'Não foi possível buscar as publicações recentes.',
        variant: 'destructive',
      });
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleSearch = async () => {
    if (!lawsuitNumber.trim()) {
      // Se não tem número de processo, volta para as publicações recentes
      setPublications(allPublications);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration/publications', {
        body: { lawsuit_id: lawsuitNumber.trim() },
      });

      if (error) throw error;

      setPublications(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: 'Nenhuma publicação encontrada',
          description: 'Não há publicações para este processo.',
        });
      }
    } catch (error) {
      console.error('Error fetching publications:', error);
      toast({
        title: 'Erro ao buscar publicações',
        description: 'Não foi possível buscar as publicações. Verifique o número do processo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setLawsuitNumber('');
    setPublications(allPublications);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Feed de Publicações
          </h1>
          <p className="text-muted-foreground mt-2">
            Publicações dos últimos 7 dias
          </p>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar por Processo Específico
            </CardTitle>
            <CardDescription>
              Deixe em branco para ver todas as publicações recentes ou informe um número de processo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Número do processo (opcional)"
                value={lawsuitNumber}
                onChange={(e) => setLawsuitNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              {lawsuitNumber && (
                <Button onClick={handleClearSearch} variant="outline">
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Publicações */}
        {loadingRecent ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : publications.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {lawsuitNumber ? 'Publicações do Processo' : 'Publicações Recentes'}
              </CardTitle>
              <CardDescription>
                {publications.length} {publications.length === 1 ? 'publicação' : 'publicações'}
                {!lawsuitNumber && ' nos últimos 7 dias'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {publications.map((publication) => (
                    <Card key={publication.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <Badge variant="outline">
                            {format(new Date(publication.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </Badge>
                          <Badge>{publication.lawsuit_number}</Badge>
                        </div>
                        <p className="text-sm mb-2">{publication.description}</p>
                        <p className="text-xs text-muted-foreground">{publication.court}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma publicação encontrada nos últimos 7 dias
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
