import { Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
}

interface ProcessingStatusProps {
  isProcessing: boolean;
  processedDocuments: ProcessedDocument[];
  processingProgress: { current: number; total: number };
  onDownload: (url: string, name: string) => void;
  onDownloadAll: () => void;
  onReset: () => void;
}

export const ProcessingStatus = ({
  isProcessing,
  processedDocuments,
  processingProgress,
  onDownload,
  onDownloadAll,
  onReset,
}: ProcessingStatusProps) => {
  if (isProcessing) {
    const progressPercentage = processingProgress.total > 0 
      ? Math.min((processingProgress.current / processingProgress.total) * 100, 100)
      : 0;

    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <div className="text-center space-y-4 w-full max-w-md">
          <div>
            <p className="text-lg font-medium text-foreground">
              Processando documentos...
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Analisando imagem {processingProgress.current} de {processingProgress.total}
            </p>
          </div>
          
          <div className="space-y-2">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {Math.round(progressPercentage)}% concluído
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (processedDocuments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">
            Processamento concluído
          </h3>
        </div>
        <div className="flex gap-2">
          <Button onClick={onReset} variant="outline">
            Nova tarefa
          </Button>
          {processedDocuments.length > 1 && (
            <Button onClick={onDownloadAll} variant="default">
              Baixar todos
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {processedDocuments.map((doc, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-card rounded-lg border border-border shadow-card hover:shadow-elegant transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{doc.name}</p>
                <p className="text-sm text-muted-foreground">
                  {doc.pageCount} {doc.pageCount === 1 ? 'página' : 'páginas'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => onDownload(doc.url, doc.name)}
              variant="outline"
              size="sm"
            >
              Baixar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
