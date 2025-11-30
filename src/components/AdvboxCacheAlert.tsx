import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Clock } from 'lucide-react';

interface AdvboxCacheAlertProps {
  metadata?: {
    fromCache: boolean;
    rateLimited: boolean;
    cacheAge: number;
  };
}

export function AdvboxCacheAlert({ metadata }: AdvboxCacheAlertProps) {
  if (!metadata) return null;

  if (metadata.rateLimited) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Limite de requisições atingido</AlertTitle>
        <AlertDescription>
          {metadata.fromCache
            ? `A API do Advbox está temporariamente indisponível. Mostrando dados em cache de ${Math.floor(metadata.cacheAge / 60)} minuto(s) atrás.`
            : 'A API do Advbox atingiu o limite de requisições. Tente novamente em alguns minutos.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (metadata.fromCache && metadata.cacheAge > 60) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Dados em cache</AlertTitle>
        <AlertDescription>
          Estes dados foram atualizados há {Math.floor(metadata.cacheAge / 60)} minuto(s). 
          Use o botão "Atualizar Dados" para buscar as informações mais recentes.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
