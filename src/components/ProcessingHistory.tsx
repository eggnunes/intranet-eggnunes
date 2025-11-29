import { ProcessingHistoryItem } from '@/hooks/useProcessingHistory';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, FileText, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProcessingHistoryProps {
  history: ProcessingHistoryItem[];
  onClearHistory: () => void;
}

export const ProcessingHistory = ({ history, onClearHistory }: ProcessingHistoryProps) => {
  if (history.length === 0) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Histórico de Processamentos
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar
        </Button>
      </div>

      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {item.fileCount} arquivo{item.fileCount !== 1 ? 's' : ''} → {item.documentCount} PDF{item.documentCount !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(item.timestamp, { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                  {item.mergedAll && ' • Mesclado'}
                </div>
              </div>
            </div>
            <div className="text-sm font-medium text-primary">
              {formatDuration(item.processingTime)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
