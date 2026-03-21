import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Copy, Mail, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JusbrasilCode {
  code: string;
  subject: string;
  receivedAt: string;
  from: string;
}

export const JusbrasilCodeFetcher = () => {
  const [codes, setCodes] = useState<JusbrasilCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [debugData, setDebugData] = useState<any>(null);

  const fetchCode = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-jusbrasil-code');

      if (error) throw error;

      setCodes(data.codes || []);
      setDebugData(data.debug || null);
      setLastFetch(new Date());

      if (data.codes?.length > 0) {
        toast.success(`${data.codes.length} código(s) encontrado(s)!`);
      } else {
        toast.info('Nenhum código de verificação encontrado nos emails recentes.');
      }
    } catch (error: any) {
      console.error('Error fetching JusBrasil code:', error);
      toast.error(error.message || 'Erro ao buscar código do JusBrasil');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Código JusBrasil
            </CardTitle>
            <CardDescription>
              Busca o último código de verificação recebido por email
            </CardDescription>
          </div>
          <Button onClick={fetchCode} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Buscando...' : 'Buscar Código'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lastFetch && (
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Última busca: {format(lastFetch, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </p>
        )}

        {codes.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Buscar Código" para verificar os emails mais recentes.
          </p>
        )}

        <div className="space-y-3">
          {codes.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold tracking-widest text-primary">
                    {item.code}
                  </span>
                  {index === 0 && (
                    <Badge variant="default" className="text-xs">Mais recente</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {item.subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(item.receivedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyCode(item.code)}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
