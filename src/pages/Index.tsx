import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
}

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const { toast } = useToast();

  const handleProcess = async () => {
    if (files.length === 0) {
      toast({
        title: "Nenhuma imagem",
        description: "Por favor, adicione pelo menos uma imagem para processar",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "API Key necessária",
        description: "Por favor, forneça sua chave de API da OpenAI",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessedDocuments([]);

    try {
      // Converter arquivos para base64
      const imagesBase64 = await Promise.all(
        files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          return {
            data: base64,
            type: file.type,
            name: file.name,
          };
        })
      );

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('process-documents', {
        body: {
          images: imagesBase64,
          apiKey: apiKey,
        },
      });

      if (error) throw error;

      setProcessedDocuments(data.documents);
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
          {/* API Key Input */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Configuração</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Chave de API da OpenAI</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Sua chave será usada apenas para este processamento e não será armazenada
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Documentos para processar
            </h2>
            <FileUpload files={files} onFilesSelected={setFiles} />
          </div>

          {/* Process Button */}
          {files.length > 0 && !isProcessing && processedDocuments.length === 0 && (
            <div className="flex justify-center">
              <Button
                onClick={handleProcess}
                size="lg"
                className="bg-gradient-primary shadow-elegant hover:shadow-card transition-all"
              >
                Processar documentos
              </Button>
            </div>
          )}

          {/* Processing Status */}
          <ProcessingStatus
            isProcessing={isProcessing}
            processedDocuments={processedDocuments}
            onDownload={handleDownload}
            onDownloadAll={handleDownloadAll}
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
