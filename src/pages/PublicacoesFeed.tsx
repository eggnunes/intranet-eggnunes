import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!lawsuitNumber.trim()) {
      toast({
        title: 'Número do processo obrigatório',
        description: 'Por favor, informe o número do processo.',
        variant: 'destructive',
      });
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Feed de Publicações
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe as publicações dos processos
          </p>
        </div>

        {/* Busca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Publicações
            </CardTitle>
            <CardDescription>
              Informe o número do processo para visualizar suas publicações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Número do processo"
                value={lawsuitNumber}
                onChange={(e) => setLawsuitNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Publicações */}
        {publications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Publicações Encontradas</CardTitle>
              <CardDescription>
                {publications.length} {publications.length === 1 ? 'publicação' : 'publicações'}
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
        )}
      </div>
    </Layout>
  );
}
