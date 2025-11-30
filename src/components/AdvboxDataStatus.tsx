import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdvboxDataStatusProps {
  lastUpdate?: Date;
  fromCache?: boolean;
}

export function AdvboxDataStatus({ lastUpdate, fromCache }: AdvboxDataStatusProps) {
  if (!lastUpdate) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>
        Última atualização: {format(lastUpdate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </span>
      {fromCache && (
        <span className="text-amber-600">(em cache)</span>
      )}
    </div>
  );
}
