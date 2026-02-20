import { useState, useEffect, useRef } from 'react';
import { GripVertical, X, Wand2, Loader2, RotateCw, Crop, FileText, Sparkles, ZoomIn, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageCropEditor } from './ImageCropEditor';
import { RotaDocLightbox } from './RotaDocLightbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface RotaDocFileCardProps {
  file: File;
  index: number;
  total: number;
  isDragging: boolean;
  isBatchProcessing: boolean;
  onRemove: () => void;
  onFileChange: (file: File) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

// Helper: resize image for AI analysis
function resizeImageForAnalysis(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
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
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
    img.src = url;
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
    img.src = url;
  });
}

export function applyCrop(
  file: File,
  cropXPercent: number,
  cropYPercent: number,
  cropWidthPercent: number,
  cropHeightPercent: number,
  rotation: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const cropX = Math.round((cropXPercent / 100) * width);
      const cropY = Math.round((cropYPercent / 100) * height);
      const cropWidth = Math.round((cropWidthPercent / 100) * width);
      const cropHeight = Math.round((cropHeightPercent / 100) * height);
      if (rotation === 90 || rotation === 270) {
        canvas.width = cropHeight;
        canvas.height = cropWidth;
      } else {
        canvas.width = cropWidth;
        canvas.height = cropHeight;
      }
      if (!ctx) { reject(new Error('Erro ao criar canvas')); return; }
      ctx.save();
      if (rotation === 90) { ctx.translate(canvas.width, 0); ctx.rotate((90 * Math.PI) / 180); }
      else if (rotation === 180) { ctx.translate(canvas.width, canvas.height); ctx.rotate((180 * Math.PI) / 180); }
      else if (rotation === 270) { ctx.translate(0, canvas.height); ctx.rotate((270 * Math.PI) / 180); }
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      ctx.restore();
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        else reject(new Error('Erro ao gerar imagem recortada'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
    img.src = url;
  });
}

// Rotate image 90° clockwise manually
function rotateImage90(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Erro canvas')); return; }
      ctx.translate(canvas.width, 0);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        else reject(new Error('Erro ao gerar imagem'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
    img.src = url;
  });
}

export const RotaDocFileCard = ({
  file,
  index,
  total,
  isDragging,
  isBatchProcessing,
  onRemove,
  onFileChange,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragEnd,
}: RotaDocFileCardProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [aiCropping, setAiCropping] = useState(false);
  const [aiRotating, setAiRotating] = useState(false);
  const [manualRotating, setManualRotating] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  const isBusy = aiCropping || aiRotating || manualRotating || isBatchProcessing;

  useEffect(() => {
    if (!isImage) { setThumbnailUrl(null); return; }
    const url = URL.createObjectURL(file);
    setThumbnailUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  const callAutoCrop = async (): Promise<AutoCropResult | null> => {
    try {
      const analysisDataUrl = await resizeImageForAnalysis(file, 800);
      const base64Data = analysisDataUrl.split(',')[1];
      const originalDimensions = await getImageDimensions(file);
      const { data, error } = await supabase.functions.invoke('auto-crop-document', {
        body: {
          imageBase64: base64Data,
          imageType: file.type || 'image/jpeg',
          originalWidth: originalDimensions.width,
          originalHeight: originalDimensions.height,
        },
      });
      if (error) throw new Error(error.message);
      return data as AutoCropResult;
    } catch (err) {
      console.error('Erro na chamada IA:', err);
      return null;
    }
  };

  const handleAiCrop = async () => {
    if (!isImage) return;
    setAiCropping(true);
    try {
      const result = await callAutoCrop();
      if (!result || !result.success) {
        toast.info('IA não conseguiu detectar um documento claro. Use o editor manual.');
        return;
      }
      const croppedFile = await applyCrop(file, result.cropX, result.cropY, result.cropWidth, result.cropHeight, result.rotation);
      onFileChange(croppedFile);
      toast.success(`Recorte IA aplicado! (${Math.round(result.confidence * 100)}% confiança)`);
    } catch {
      toast.error('Erro no recorte automático. Tente o editor manual.');
    } finally {
      setAiCropping(false);
    }
  };

  const handleAiRotate = async () => {
    if (!isImage) return;
    setAiRotating(true);
    try {
      const result = await callAutoCrop();
      if (!result || !result.success || result.rotation === 0) {
        toast.info('Imagem já está na orientação correta.');
        return;
      }
      // Apply only rotation, no crop (full image)
      const rotatedFile = await applyCrop(file, 0, 0, 100, 100, result.rotation);
      onFileChange(rotatedFile);
      toast.success(`Rotação IA aplicada! (${result.rotation}°)`);
    } catch {
      toast.error('Erro na rotação automática.');
    } finally {
      setAiRotating(false);
    }
  };

  const handleManualRotate = async () => {
    if (!isImage) return;
    setManualRotating(true);
    try {
      const rotated = await rotateImage90(file);
      onFileChange(rotated);
    } catch {
      toast.error('Erro ao rotacionar imagem.');
    } finally {
      setManualRotating(false);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        className={`rounded-xl border bg-card transition-all ${
          isDragging ? 'opacity-50 scale-95 border-primary' : 'border-border hover:border-primary/40'
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Drag handle + order buttons */}
          <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
            <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0 || isBusy}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === total - 1 || isBusy}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>

          {/* Thumbnail */}
          <div
            className="shrink-0 w-28 h-28 rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center cursor-pointer group relative"
            onClick={() => setShowLightbox(true)}
          >
            {isPdf ? (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <FileText className="w-10 h-10 text-primary" />
                <span className="text-[10px]">PDF</span>
              </div>
            ) : thumbnailUrl ? (
              <>
                <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <FileText className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Info + buttons */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {isPdf ? 'PDF' : file.type}
              </p>
            </div>

            {/* AI buttons */}
            {isImage && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">IA:</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleAiCrop}
                    disabled={isBusy}
                  >
                    {aiCropping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Recortar IA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleAiRotate}
                    disabled={isBusy}
                  >
                    {aiRotating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Rotacionar IA
                  </Button>
                </div>
              </div>
            )}

            {/* Manual buttons */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Manual:</p>
              <div className="flex flex-wrap gap-1.5">
                {isImage && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setShowCropEditor(true)}
                      disabled={isBusy}
                    >
                      <Crop className="w-3 h-3" />
                      Recortar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleManualRotate}
                      disabled={isBusy}
                    >
                      {manualRotating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                      Girar 90°
                    </Button>
                  </>
                )}
                {isPdf && (
                  <Badge variant="secondary" className="text-xs">PDF — IA não disponível</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={isBusy}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Crop editor */}
      {isImage && (
        <ImageCropEditor
          file={file}
          isOpen={showCropEditor}
          onClose={() => setShowCropEditor(false)}
          onSave={(edited) => { onFileChange(edited); setShowCropEditor(false); }}
        />
      )}

      {/* Lightbox */}
      <RotaDocLightbox
        file={file}
        imageUrl={thumbnailUrl}
        isOpen={showLightbox}
        onClose={() => setShowLightbox(false)}
      />
    </>
  );
};
