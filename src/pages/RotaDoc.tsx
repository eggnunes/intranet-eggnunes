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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import heic2any from 'heic2any';
import { PDFDocument } from 'pdf-lib';
interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
  documentType?: string;
  legibilityWarnings?: string[];
}

export default function RotaDoc() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [mergeAll, setMergeAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0, estimatedTimeRemaining: 0 });
  const [legibilityWarnings, setLegibilityWarnings] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert HEIC files to JPEG
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    if (file.type === 'image/heic' || file.type === 'image/heif' || 
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        console.log(`Convertendo ${file.name} de HEIC para JPEG...`);
        const blob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.92,
        });
        
        // heic2any can return array of blobs for multi-image HEIC
        const resultBlob = Array.isArray(blob) ? blob[0] : blob;
        const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        const convertedFile = new File([resultBlob], newName, { type: 'image/jpeg' });
        console.log(`${file.name} convertido com sucesso para ${newName}`);
        return convertedFile;
      } catch (error) {
        console.error(`Erro ao converter ${file.name}:`, error);
        throw new Error(`Não foi possível converter ${file.name}. Por favor, converta para JPG manualmente.`);
      }
    }
    return file;
  };

  // Resize image on client-side before sending to avoid server memory issues
  const resizeImage = (file: File, maxDimension: number = 1200): Promise<File> => {
    return new Promise((resolve, reject) => {
      // PDFs don't need resizing
      if (file.type === 'application/pdf') {
        resolve(file);
        return;
      }
      
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        
        // Only resize if larger than max dimension
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          console.log(`Redimensionando ${file.name} para ${width}x${height}`);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(resizedFile);
            } else {
              resolve(file); // Fallback to original
            }
          },
          'image/jpeg',
          0.85 // Quality
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file); // Fallback to original on error
      };
      img.src = url;
    });
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
    setLegibilityWarnings([]);
    const startTime = Date.now();
    setProgress({ current: 0, total: files.length, startTime, estimatedTimeRemaining: 0 });

    try {
      // Convert HEIC files first
      const convertedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            return await convertHeicToJpeg(file);
          } catch (error) {
            throw error;
          }
        })
      );

      // Resize images on client-side before sending
      const resizedFiles = await Promise.all(
        convertedFiles.map(file => resizeImage(file, 1200))
      );

      const filesData = await Promise.all(
        resizedFiles.map(async (file) => {
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

      // Process files in batches of 2 to avoid memory issues
      const BATCH_SIZE = 2;
      const batchDocuments: ProcessedDocument[] = [];
      const allWarnings: string[] = [];
      
      for (let i = 0; i < filesData.length; i += BATCH_SIZE) {
        const batch = filesData.slice(i, i + BATCH_SIZE);
        console.log(`Processando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(filesData.length / BATCH_SIZE)}`);
        
        setProgress(prev => ({
          ...prev,
          current: i,
          estimatedTimeRemaining: Math.round(((Date.now() - startTime) / (i + 1)) * (filesData.length - i - 1) / 1000)
        }));
        
        const { data, error } = await supabase.functions.invoke('process-documents', {
          body: {
            files: batch,
            mergeAll: true,
          },
        });

        if (error) {
          console.error('Erro no lote:', error);
          allWarnings.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message || 'Erro no processamento'}`);
          continue;
        }

        if (data?.documents) {
          batchDocuments.push(...data.documents);
        }
        if (data?.legibilityWarnings) {
          allWarnings.push(...data.legibilityWarnings);
        }
      }

      if (batchDocuments.length === 0) {
        throw new Error('Nenhum documento foi processado com sucesso');
      }

      // If mergeAll is enabled and we have multiple PDFs from batches, merge them client-side
      let allDocuments: ProcessedDocument[];
      if (mergeAll && batchDocuments.length > 1) {
        console.log(`Mesclando ${batchDocuments.length} PDFs em um único documento...`);
        try {
          const mergedPdf = await PDFDocument.create();
          
          for (const doc of batchDocuments) {
            // Extract base64 from data URL
            const base64Data = doc.url.split(',')[1];
            const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const sourcePdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          }
          
          const mergedBytes = await mergedPdf.save();
          const mergedBase64 = btoa(
            mergedBytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          const totalPages = mergedPdf.getPageCount();
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          
          allDocuments = [{
            name: `Documento_Mesclado_${timestamp}.pdf`,
            url: `data:application/pdf;base64,${mergedBase64}`,
            pageCount: totalPages,
          }];
          
          console.log(`PDF mesclado gerado com ${totalPages} páginas`);
        } catch (mergeError) {
          console.error('Erro ao mesclar PDFs:', mergeError);
          allWarnings.push('Não foi possível mesclar os PDFs. Documentos individuais foram mantidos.');
          allDocuments = batchDocuments;
        }
      } else {
        allDocuments = batchDocuments;
      }

      setProcessedDocuments(allDocuments);
      
      if (allWarnings.length > 0) {
        setLegibilityWarnings(allWarnings);
      }
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Registrar no histórico
      await supabase.from('usage_history').insert({
        user_id: user?.id,
        tool_name: 'RotaDoc',
        action: 'Processamento de documentos concluído',
        metadata: {
          fileCount: files.length,
          documentCount: allDocuments.length,
          processingTime,
          mergeAll,
        },
      });

      toast({
        title: 'Processamento concluído',
        description: `${allDocuments.length} documento(s) gerado(s) com sucesso!`,
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
    setLegibilityWarnings([]);
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
              <li><strong>Suporte múltiplos formatos:</strong> Processa imagens (JPG, PNG, HEIC) e PDFs com múltiplas páginas</li>
              <li><strong>Conversão automática:</strong> Arquivos HEIC (iPhone) são convertidos automaticamente para JPEG</li>
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

        {/* Legibility Warnings */}
        {legibilityWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Problemas de Legibilidade Detectados</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {legibilityWarnings.map((warning, index) => (
                  <li key={index} className="text-sm">{warning}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                Considere digitalizar novamente os documentos com melhor qualidade.
              </p>
            </AlertDescription>
          </Alert>
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
