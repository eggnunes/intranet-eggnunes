import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { FileUpload } from '@/components/FileUpload';
import { FilePreview } from '@/components/FilePreview';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
}

export default function RotaDoc() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [mergeAll, setMergeAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0, estimatedTimeRemaining: 0 });
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, adicione arquivos antes de processar.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    const startTime = Date.now();
    setProgress({ current: 0, total: files.length, startTime, estimatedTimeRemaining: 0 });

    try {
      const filesData = await Promise.all(
        files.map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(file);
          });

          return {
            name: file.name,
            data: base64,
            type: file.type,
          };
        })
      );

      const { data, error } = await supabase.functions.invoke('process-documents', {
        body: {
          files: filesData,
          mergeAll,
        },
      });

      if (error) throw error;

      setProcessedDocuments(data.documents || []);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Registrar no histórico
      await supabase.from('usage_history').insert({
        user_id: user?.id,
        tool_name: 'RotaDoc',
        action: 'Processamento de documentos concluído',
        metadata: {
          fileCount: files.length,
          documentCount: data.documents?.length || 0,
          processingTime,
          mergeAll,
        },
      });

      toast({
        title: 'Processamento concluído',
        description: `${data.documents?.length || 0} documento(s) gerado(s) com sucesso!`,
      });
    } catch (error: any) {
      console.error('Erro ao processar documentos:', error);
      toast({
        title: 'Erro no processamento',
        description: error.message || 'Ocorreu um erro ao processar os documentos.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = () => {
    processedDocuments.forEach((doc) => {
      handleDownload(doc.url, doc.name);
    });
  };

  const handleReset = () => {
    setFiles([]);
    setProcessedDocuments([]);
    setProgress({ current: 0, total: 0, startTime: 0, estimatedTimeRemaining: 0 });
    toast({
      title: 'Nova tarefa iniciada',
      description: 'O sistema foi resetado para um novo processamento.',
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">RotaDoc</h1>
          <p className="text-muted-foreground text-lg">
            Rotação e Organização Inteligente de Documentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona?</CardTitle>
            <CardDescription>
              Ferramenta de IA para processamento automatizado de documentos
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ul className="text-muted-foreground space-y-2">
              <li><strong>Correção automática de orientação:</strong> Detecta e corrige páginas que estão de cabeça para baixo, rotacionadas ou invertidas</li>
              <li><strong>Identificação inteligente:</strong> Reconhece automaticamente tipos de documentos (relatórios médicos, procurações, etc.)</li>
              <li><strong>Organização por tipo:</strong> Agrupa documentos similares em PDFs separados ou mescla tudo em um único arquivo</li>
              <li><strong>Suporte múltiplos formatos:</strong> Processa imagens (JPG, PNG) e PDFs com múltiplas páginas</li>
              <li><strong>Extração de PDFs:</strong> Extrai páginas individuais de PDFs para análise e correção</li>
            </ul>
          </CardContent>
        </Card>

        <FileUpload onFilesSelected={setFiles} files={files} />
            
        {files.length > 0 && (
          <>
            <FilePreview
              files={files}
              onFilesChange={setFiles}
              onRemove={handleRemoveFile}
            />

            <Card>
              <CardHeader>
                <CardTitle>Opções de Processamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="merge-all">Mesclar todos em um único PDF</Label>
                    <p className="text-sm text-muted-foreground">
                      {mergeAll
                        ? 'Todos os arquivos serão mesclados em um único documento'
                        : 'Documentos serão agrupados por tipo (recomendado)'}
                    </p>
                  </div>
                  <Switch
                    id="merge-all"
                    checked={mergeAll}
                    onCheckedChange={setMergeAll}
                  />
                </div>

                <Button
                  onClick={handleProcess}
                  disabled={processing}
                  className="w-full"
                  size="lg"
                >
                  {processing ? 'Processando...' : 'Processar Documentos'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <ProcessingStatus
          isProcessing={processing}
          processedDocuments={processedDocuments}
          processingProgress={progress}
          onDownload={handleDownload}
          onDownloadAll={handleDownloadAll}
          onReset={handleReset}
        />
      </div>
    </Layout>
  );
}
