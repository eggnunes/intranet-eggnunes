import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { RotaDocFileCard, applyCrop } from '@/components/RotaDocFileCard';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import heic2any from 'heic2any';
import { PDFDocument } from 'pdf-lib';

interface ProcessedDocument {
  name: string;
  url: string;
  pageCount: number;
  documentType?: string;
  legibilityWarnings?: string[];
}

interface AutoCropResult {
  success: boolean;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
  confidence: number;
  documentType?: string;
  message?: string;
}

export default function RotaDoc() {
  const [files, setFiles] = useState<File[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [mergeAll, setMergeAll] = useState<'merge' | 'separate'>('merge');
  const [progress, setProgress] = useState({ current: 0, total: 0, startTime: 0, estimatedTimeRemaining: 0 });
  const [legibilityWarnings, setLegibilityWarnings] = useState<string[]>([]);

  // Batch AI state
  const [batchAiProgress, setBatchAiProgress] = useState({ current: 0, total: 0 });
  const [batchAiRunning, setBatchAiRunning] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  // ─── File management ───────────────────────────────────────────────────────

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (index: number, newFile: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = newFile;
      return next;
    });
  };

  const moveFile = (fromIndex: number, toIndex: number) => {
    const newFiles = [...files];
    const [moved] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, moved);
    setFiles(newFiles);
  };

  // ─── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragStart = (index: number) => setDraggedIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveFile(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => setDraggedIndex(null);

  // ─── Batch AI ──────────────────────────────────────────────────────────────

  const handleBatchAI = async () => {
    const imageIndices = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.type.startsWith('image/'));

    if (imageIndices.length === 0) {
      toast({ title: 'Nenhuma imagem', description: 'Somente imagens podem ser processadas pela IA.' });
      return;
    }

    setBatchAiRunning(true);
    setBatchAiProgress({ current: 0, total: imageIndices.length });

    const newFiles = [...files];
    const docTypeOrder: { index: number; docType: string }[] = [];

    for (let step = 0; step < imageIndices.length; step++) {
      const { f: file, i: fileIndex } = imageIndices[step];
      setBatchAiProgress({ current: step + 1, total: imageIndices.length });

      try {
        // Resize for analysis
        const analysisUrl = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            const max = 800;
            if (width > max || height > max) {
              const scale = max / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            canvas.width = width; canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro')); };
          img.src = url;
        });

        const dimUrl = URL.createObjectURL(file);
        const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(dimUrl); resolve({ width: img.width, height: img.height }); };
          img.onerror = () => { URL.revokeObjectURL(dimUrl); reject(new Error('Erro')); };
          img.src = dimUrl;
        });

        const { data, error } = await supabase.functions.invoke('auto-crop-document', {
          body: {
            imageBase64: analysisUrl.split(',')[1],
            imageType: file.type || 'image/jpeg',
            originalWidth: dims.width,
            originalHeight: dims.height,
          },
        });

        if (error || !data) continue;
        const result = data as AutoCropResult;
        if (!result.success) continue;

        const isSignificant =
          result.cropX > 3 || result.cropY > 3 ||
          result.cropWidth < 94 || result.cropHeight < 94 ||
          result.rotation !== 0;

        if (isSignificant) {
          newFiles[fileIndex] = await applyCrop(
            file, result.cropX, result.cropY, result.cropWidth, result.cropHeight, result.rotation
          );
        }

        if (result.documentType) {
          docTypeOrder.push({ index: fileIndex, docType: result.documentType });
        }
      } catch (err) {
        console.error(`Erro IA no arquivo ${file.name}:`, err);
      }
    }

    // Reorder by document type (group similar doc types together)
    if (docTypeOrder.length > 1) {
      const nonImageIndices = files
        .map((_, i) => i)
        .filter(i => !files[i].type.startsWith('image/'));

      // Sort image indices by documentType to group them
      const sortedImageIndices = docTypeOrder
        .sort((a, b) => a.docType.localeCompare(b.docType))
        .map(d => d.index);

      const allSortedIndices = [
        ...sortedImageIndices,
        ...nonImageIndices.filter(i => !sortedImageIndices.includes(i)),
      ];

      const reordered = allSortedIndices.map(i => newFiles[i]);
      setFiles(reordered);
    } else {
      setFiles(newFiles);
    }

    setBatchAiRunning(false);
    toast({
      title: '✨ IA aplicada em lote',
      description: `${imageIndices.length} imagem(ns) processada(s). Verifique as pré-visualizações.`,
    });
  };

  // ─── Processing ────────────────────────────────────────────────────────────

  const convertHeicToJpeg = async (file: File): Promise<File> => {
    if (
      file.type === 'image/heic' || file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    ) {
      try {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        const resultBlob = Array.isArray(blob) ? blob[0] : blob;
        const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        return new File([resultBlob], newName, { type: 'image/jpeg' });
      } catch (error) {
        throw new Error(`Não foi possível converter ${file.name}.`);
      }
    }
    return file;
  };

  const resizeImage = (file: File, maxDimension = 1200): Promise<File> => {
    return new Promise((resolve) => {
      if (file.type === 'application/pdf') { resolve(file); return; }
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width; canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
          'image/jpeg', 0.85
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });

  const handleProcess = async () => {
    if (files.length === 0) {
      toast({ title: 'Nenhum arquivo', description: 'Adicione arquivos antes de processar.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setLegibilityWarnings([]);
    const startTime = Date.now();
    setProgress({ current: 0, total: files.length, startTime, estimatedTimeRemaining: 0 });

    try {
      // Separate images and PDFs
      const imageFiles: { file: File; originalIndex: number }[] = [];
      const pdfFiles: { file: File; originalIndex: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        if (files[i].type === 'application/pdf') {
          pdfFiles.push({ file: files[i], originalIndex: i });
        } else {
          imageFiles.push({ file: files[i], originalIndex: i });
        }
      }

      // Convert + resize images
      const convertedImages = await Promise.all(
        imageFiles.map(async ({ file, originalIndex }) => {
          const converted = await convertHeicToJpeg(file);
          const resized = await resizeImage(converted, 1200);
          return { file: resized, originalIndex };
        })
      );

      // Process images via edge function in batches of 2 (mergeAll=false each time)
      const BATCH_SIZE = 2;
      const processedByOriginalIndex = new Map<number, ProcessedDocument>();
      const allWarnings: string[] = [];

      for (let i = 0; i < convertedImages.length; i += BATCH_SIZE) {
        const batch = convertedImages.slice(i, i + BATCH_SIZE);

        setProgress(prev => ({
          ...prev,
          current: i,
          estimatedTimeRemaining: Math.round(((Date.now() - startTime) / (i + 1)) * (convertedImages.length - i - 1) / 1000),
        }));

        const filesData = await Promise.all(
          batch.map(async ({ file }) => ({
            name: file.name,
            data: await fileToBase64(file),
            type: file.type,
          }))
        );

        const { data, error } = await supabase.functions.invoke('process-documents', {
          body: { files: filesData, mergeAll: false },
        });

        if (error) {
          allWarnings.push(`Erro no lote: ${error.message}`);
          continue;
        }

        if (data?.documents) {
          data.documents.forEach((doc: ProcessedDocument, batchIdx: number) => {
            const { originalIndex } = batch[batchIdx] || batch[0];
            processedByOriginalIndex.set(originalIndex, doc);
          });
        }
        if (data?.legibilityWarnings) allWarnings.push(...data.legibilityWarnings);
      }

      // Convert PDFs to ProcessedDocument (pass directly, no reprocessing)
      for (const { file, originalIndex } of pdfFiles) {
        const base64 = await fileToBase64(file);
        processedByOriginalIndex.set(originalIndex, {
          name: file.name,
          url: `data:application/pdf;base64,${base64}`,
          pageCount: 1,
        });
      }

      // Reassemble in original order
      const orderedDocs: ProcessedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const doc = processedByOriginalIndex.get(i);
        if (doc) orderedDocs.push(doc);
      }

      if (orderedDocs.length === 0) throw new Error('Nenhum documento foi processado com sucesso');

      // Merge client-side if user chose merge
      let allDocuments: ProcessedDocument[];
      if (mergeAll === 'merge' && orderedDocs.length > 1) {
        try {
          const mergedPdf = await PDFDocument.create();
          for (const doc of orderedDocs) {
            const base64Data = doc.url.split(',')[1];
            const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const sourcePdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          }
          const mergedBytes = await mergedPdf.save();
          const mergedBase64 = btoa(mergedBytes.reduce((d, b) => d + String.fromCharCode(b), ''));
          const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          allDocuments = [{
            name: `Documento_Mesclado_${timestamp}.pdf`,
            url: `data:application/pdf;base64,${mergedBase64}`,
            pageCount: mergedPdf.getPageCount(),
          }];
        } catch (mergeError) {
          console.error('Erro ao mesclar PDFs:', mergeError);
          allWarnings.push('Não foi possível mesclar os PDFs. Documentos individuais foram mantidos.');
          allDocuments = orderedDocs;
        }
      } else {
        allDocuments = orderedDocs;
      }

      setProcessedDocuments(allDocuments);
      if (allWarnings.length > 0) setLegibilityWarnings(allWarnings);

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      await supabase.from('usage_history').insert({
        user_id: user?.id,
        tool_name: 'RotaDoc',
        action: 'Processamento de documentos concluído',
        metadata: { fileCount: files.length, documentCount: allDocuments.length, processingTime, mergeAll },
      });

      toast({ title: 'Processamento concluído', description: `${allDocuments.length} documento(s) gerado(s)!` });
    } catch (error: any) {
      console.error('Erro ao processar documentos:', error);
      toast({ title: 'Erro no processamento', description: error.message || 'Ocorreu um erro.', variant: 'destructive' });
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

  const handleDownloadAll = () => processedDocuments.forEach(doc => handleDownload(doc.url, doc.name));

  const handleReset = () => {
    setFiles([]);
    setProcessedDocuments([]);
    setLegibilityWarnings([]);
    setProgress({ current: 0, total: 0, startTime: 0, estimatedTimeRemaining: 0 });
    toast({ title: 'Nova tarefa iniciada', description: 'Sistema resetado para novo processamento.' });
  };

  const imageCount = files.filter(f => f.type.startsWith('image/')).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">RotaDoc</h1>
          <p className="text-muted-foreground text-lg">Rotação e Organização Inteligente de Documentos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona?</CardTitle>
            <CardDescription>Ferramenta de IA para processamento automatizado de documentos</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ul className="text-muted-foreground space-y-2">
              <li><strong>Pré-visualização antes de processar:</strong> Revise, reordene e ajuste cada documento antes de gerar o PDF final</li>
              <li><strong>Recorte e rotação por IA:</strong> Clique em "Recortar IA" ou "Rotacionar IA" em cada arquivo — ou use "✨ Aplicar IA em todos"</li>
              <li><strong>Ajuste manual:</strong> Recorte manualmente ou gire 90° com os botões manuais de cada card</li>
              <li><strong>Ampliar miniatura:</strong> Clique na miniatura de qualquer arquivo para ver em tamanho grande</li>
              <li><strong>Reordenar por drag-and-drop:</strong> Arraste os cards para definir a ordem final</li>
              <li><strong>Suporte múltiplos formatos:</strong> JPG, PNG, HEIC e PDFs</li>
            </ul>
          </CardContent>
        </Card>

        {/* Upload */}
        {files.length === 0 && (
          <FileUpload onFilesSelected={setFiles} files={files} />
        )}

        {/* Preview & Adjust stage */}
        {files.length > 0 && !processing && processedDocuments.length === 0 && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                Pré-visualização ({files.length} arquivo{files.length > 1 ? 's' : ''})
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setFiles([]); }}
                >
                  Trocar arquivos
                </Button>
                {imageCount >= 1 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={handleBatchAI}
                    disabled={batchAiRunning}
                  >
                    {batchAiRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {batchAiRunning
                      ? `IA processando ${batchAiProgress.current}/${batchAiProgress.total}...`
                      : `✨ Aplicar IA em todos (${imageCount} imagem${imageCount > 1 ? 's' : ''})`}
                  </Button>
                )}
              </div>
            </div>

            {/* Batch AI progress */}
            {batchAiRunning && (
              <div className="space-y-1">
                <Progress value={(batchAiProgress.current / batchAiProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Processando {batchAiProgress.current} de {batchAiProgress.total} imagens...
                </p>
              </div>
            )}

            {/* File cards */}
            <div className="space-y-3">
              {files.map((file, index) => (
                <RotaDocFileCard
                  key={`${file.name}-${index}`}
                  file={file}
                  index={index}
                  total={files.length}
                  isDragging={draggedIndex === index}
                  isBatchProcessing={batchAiRunning}
                  onRemove={() => handleRemoveFile(index)}
                  onFileChange={(f) => handleFileChange(index, f)}
                  onMoveUp={() => moveFile(index, index - 1)}
                  onMoveDown={() => moveFile(index, index + 1)}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>

            {/* Output options */}
            <Card>
              <CardHeader>
                <CardTitle>Opções de saída</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={mergeAll} onValueChange={(v) => setMergeAll(v as 'merge' | 'separate')}>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="merge" id="merge" className="mt-1" />
                    <Label htmlFor="merge" className="cursor-pointer">
                      <span className="font-medium">Juntar tudo em 1 PDF único</span>
                      <p className="text-sm text-muted-foreground">Todos os arquivos mesclados em um único documento</p>
                    </Label>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="separate" id="separate" className="mt-1" />
                    <Label htmlFor="separate" className="cursor-pointer">
                      <span className="font-medium">Manter documentos separados</span>
                      <p className="text-sm text-muted-foreground">Cada arquivo vira um PDF individual para download</p>
                    </Label>
                  </div>
                </RadioGroup>

                <Button onClick={handleProcess} disabled={processing} className="w-full" size="lg">
                  {processing ? 'Processando...' : 'Processar Documentos'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Legibility Warnings */}
        {legibilityWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Problemas Detectados</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {legibilityWarnings.map((w, i) => <li key={i} className="text-sm">{w}</li>)}
              </ul>
              <p className="mt-2 text-sm">Considere digitalizar novamente com melhor qualidade.</p>
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
