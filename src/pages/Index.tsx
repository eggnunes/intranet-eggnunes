import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { FilePreview } from '@/components/FilePreview';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { ProcessingHistory } from '@/components/ProcessingHistory';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useProcessingHistory } from '@/hooks/useProcessingHistory';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
}

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [mergeAll, setMergeAll] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ 
    current: 0, 
    total: 0, 
    startTime: 0,
    estimatedTimeRemaining: 0
  });
  const { toast } = useToast();
  const { history, addToHistory, clearHistory } = useProcessingHistory();

  const handleProcess = async () => {
    if (files.length === 0) {
      toast({
        title: "Nenhuma imagem",
        description: "Por favor, adicione pelo menos uma imagem para processar",
        variant: "destructive",
      });
      return;
    }

    const startTime = Date.now();
    setIsProcessing(true);
    setProcessedDocuments([]);
    setProcessingProgress({ 
      current: 0, 
      total: files.length,
      startTime,
      estimatedTimeRemaining: 0
    });

    try {
      // Converter arquivos para base64
      const imagesBase64 = await Promise.all(
        files.map(async (file, index) => {
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          // Atualizar progresso de conversão com estimativa de tempo
          const elapsed = Date.now() - startTime;
          const avgTimePerImage = elapsed / (index + 1);
          const remaining = Math.ceil((avgTimePerImage * (files.length - (index + 1))) / 1000);
          
          setProcessingProgress({ 
            current: index + 1, 
            total: files.length,
            startTime,
            estimatedTimeRemaining: remaining
          });
          
          return {
            data: base64,
            type: file.type,
            name: file.name,
          };
        })
      );

      // Atualizar progresso durante análise AI
      let analysisCount = 0;
      const progressInterval = setInterval(() => {
        analysisCount++;
        const elapsed = Date.now() - startTime;
        const avgTimePerImage = elapsed / Math.max(analysisCount, 1);
        const remaining = Math.ceil((avgTimePerImage * (files.length - analysisCount)) / 1000);
        
        setProcessingProgress(prev => {
          if (prev.current >= prev.total) return prev;
          return { 
            current: Math.min(prev.current + 1, files.length),
            total: prev.total,
            startTime: prev.startTime,
            estimatedTimeRemaining: Math.max(remaining, 0)
          };
        });
      }, 3000); // Incrementar a cada 3 segundos (estimativa de tempo de análise)

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('process-documents', {
        body: {
          images: imagesBase64,
          mergeAll,
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;

      setProcessingProgress({ 
        current: files.length, 
        total: files.length,
        startTime,
        estimatedTimeRemaining: 0
      });
      setProcessedDocuments(data.documents);
      
      // Salvar no histórico
      const processingTime = Math.floor((Date.now() - startTime) / 1000);
      addToHistory({
        fileCount: files.length,
        processingTime,
        documentCount: data.documents.length,
        mergedAll: mergeAll,
      });
      
      toast({
        title: "Sucesso!",
        description: `${data.documents.length} documento(s) processado(s) com sucesso`,
      });
    } catch (error) {
      console.error('Erro ao processar:', error);
      toast({
        title: "Erro no processamento",
        description: "Ocorreu um erro ao processar os documentos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ 
        current: 0, 
        total: 0,
        startTime: 0,
        estimatedTimeRemaining: 0
      });
    }
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    processedDocuments.forEach((doc) => {
      setTimeout(() => handleDownload(doc.url, doc.name), 100);
    });
  };

  const handleReset = () => {
    setFiles([]);
    setProcessedDocuments([]);
    setMergeAll(false);
    toast({
      title: "Aplicativo reiniciado",
      description: "Pronto para processar novos documentos",
    });
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">DocuProcess</h1>
              <p className="text-sm text-muted-foreground">
                Organize e converta documentos automaticamente
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Processing History */}
          {history.length > 0 && processedDocuments.length === 0 && !isProcessing && (
            <ProcessingHistory history={history} onClearHistory={clearHistory} />
          )}

          {/* File Upload */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Adicionar Documentos
            </h2>
            <FileUpload files={files} onFilesSelected={setFiles} />
          </div>

          {/* File Preview & Reorder */}
          {files.length > 0 && processedDocuments.length === 0 && (
            <div className="bg-card p-6 rounded-xl border border-border shadow-card">
              <FilePreview 
                files={files} 
                onFilesChange={setFiles}
                onRemove={handleRemoveFile}
              />
            </div>
          )}

          {/* Options & Process Button */}
          {files.length > 0 && !isProcessing && processedDocuments.length === 0 && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-xl border border-border shadow-card">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="merge-all" className="text-base font-medium">
                      Mesclar todos em um único PDF
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativado, todos os documentos serão unidos em um único arquivo PDF
                    </p>
                  </div>
                  <Switch
                    id="merge-all"
                    checked={mergeAll}
                    onCheckedChange={setMergeAll}
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleProcess}
                  size="lg"
                  className="bg-gradient-primary shadow-elegant hover:shadow-card transition-all"
                >
                  Processar documentos ({files.length} arquivo{files.length !== 1 ? 's' : ''})
                </Button>
              </div>
            </div>
          )}

          {/* Processing Status */}
          <ProcessingStatus
            isProcessing={isProcessing}
            processedDocuments={processedDocuments}
            processingProgress={processingProgress}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
            onReset={handleReset}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
