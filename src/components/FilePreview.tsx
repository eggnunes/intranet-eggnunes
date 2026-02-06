import { useState, useMemo, useEffect } from 'react';
import { Upload, X, GripVertical, ArrowUp, ArrowDown, Pencil, Wand2, Loader2, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ImageCropEditor } from './ImageCropEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FilePreviewProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemove: (index: number) => void;
}

interface AutoCropResult {
  success: boolean;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
  confidence: number;
  message?: string;
}

export const FilePreview = ({ files, onFilesChange, onRemove }: FilePreviewProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [autoCroppingIndex, setAutoCroppingIndex] = useState<number | null>(null);
  const [batchCropping, setBatchCropping] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const moveFile = (fromIndex: number, toIndex: number) => {
    const newFiles = [...files];
    const [movedFile] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, movedFile);
    onFilesChange(newFiles);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      moveFile(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < files.length - 1) {
      moveFile(index, index + 1);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveFile(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleEditImage = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEditedImage = (editedFile: File) => {
    if (editingIndex !== null) {
      const newFiles = [...files];
      newFiles[editingIndex] = editedFile;
      onFilesChange(newFiles);
    }
  };

  const isImageFile = (file: File) => file.type.startsWith('image/');

  // Auto-crop with AI
  const handleAutoCrop = async (index: number) => {
    const file = files[index];
    if (!isImageFile(file)) return;

    setAutoCroppingIndex(index);
    
    try {
      // Create a smaller version for analysis (max 800px)
      const analysisDataUrl = await resizeImageForAnalysis(file, 800);
      const base64Data = analysisDataUrl.split(',')[1];
      
      // Get original dimensions
      const originalDimensions = await getImageDimensions(file);
      
      // Call AI to detect crop area
      const { data, error } = await supabase.functions.invoke('auto-crop-document', {
        body: {
          imageBase64: base64Data,
          imageType: file.type || 'image/jpeg',
          originalWidth: originalDimensions.width,
          originalHeight: originalDimensions.height,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao analisar imagem');
      }

      const result = data as AutoCropResult;
      
      if (!result.success) {
        toast.info('Recorte automático', {
          description: result.message || 'Não foi possível detectar um documento claro. Use o editor manual.',
        });
        return;
      }

      // Check if crop is significant (removes at least 3% from any side)
      const isSignificant = 
        result.cropX > 3 || 
        result.cropY > 3 || 
        result.cropWidth < 94 || 
        result.cropHeight < 94 ||
        result.rotation !== 0;

      if (!isSignificant) {
        toast.info('Recorte automático', {
          description: 'A imagem já está bem enquadrada. Nenhum recorte necessário.',
        });
        return;
      }

      // Apply the crop
      const croppedFile = await applyCrop(
        file,
        result.cropX,
        result.cropY,
        result.cropWidth,
        result.cropHeight,
        result.rotation
      );

      const newFiles = [...files];
      newFiles[index] = croppedFile;
      onFilesChange(newFiles);

      toast.success('Recorte automático aplicado!', {
        description: `Documento detectado com ${Math.round(result.confidence * 100)}% de confiança.`,
      });

    } catch (err) {
      console.error('Erro no recorte automático:', err);
      toast.error('Erro no recorte automático', {
        description: 'Não foi possível processar a imagem. Tente o editor manual.',
      });
    } finally {
      setAutoCroppingIndex(null);
    }
  };

  // Batch auto-crop all images at once
  const handleBatchAutoCrop = async () => {
    const imageIndices = files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => isImageFile(file));

    if (imageIndices.length === 0) {
      toast.info('Nenhuma imagem encontrada para recorte automático.');
      return;
    }

    setBatchCropping(true);
    setBatchProgress({ current: 0, total: imageIndices.length });

    const newFiles = [...files];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < imageIndices.length; i++) {
      const { file, index } = imageIndices[i];
      setBatchProgress({ current: i + 1, total: imageIndices.length });

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

        if (error) {
          errorCount++;
          continue;
        }

        const result = data as AutoCropResult;

        if (!result.success) {
          skipCount++;
          continue;
        }

        const isSignificant =
          result.cropX > 3 ||
          result.cropY > 3 ||
          result.cropWidth < 94 ||
          result.cropHeight < 94 ||
          result.rotation !== 0;

        if (!isSignificant) {
          skipCount++;
          continue;
        }

        const croppedFile = await applyCrop(
          file,
          result.cropX,
          result.cropY,
          result.cropWidth,
          result.cropHeight,
          result.rotation
        );

        newFiles[index] = croppedFile;
        successCount++;
      } catch (err) {
        console.error(`Erro no auto-crop do arquivo ${file.name}:`, err);
        errorCount++;
      }
    }

    onFilesChange(newFiles);
    setBatchCropping(false);

    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} recortada(s)`);
    if (skipCount > 0) parts.push(`${skipCount} sem necessidade`);
    if (errorCount > 0) parts.push(`${errorCount} com erro`);

    toast.success('Recorte em lote concluído', {
      description: parts.join(', '),
    });
  };

  // Resize image for analysis to save bandwidth
  const resizeImageForAnalysis = (file: File, maxDimension: number): Promise<string> => {
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
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Erro ao carregar imagem'));
      };
      img.src = url;
    });
  };

  // Get original image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Erro ao carregar imagem'));
      };
      img.src = url;
    });
  };

  // Apply crop to image
  const applyCrop = (
    file: File,
    cropXPercent: number,
    cropYPercent: number,
    cropWidthPercent: number,
    cropHeightPercent: number,
    rotation: number
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        URL.revokeObjectURL(url);
        const { width, height } = img;
        
        // Calculate pixel values from percentages
        const cropX = Math.round((cropXPercent / 100) * width);
        const cropY = Math.round((cropYPercent / 100) * height);
        const cropWidth = Math.round((cropWidthPercent / 100) * width);
        const cropHeight = Math.round((cropHeightPercent / 100) * height);
        
        // Handle rotation
        if (rotation === 90 || rotation === 270) {
          canvas.width = cropHeight;
          canvas.height = cropWidth;
        } else {
          canvas.width = cropWidth;
          canvas.height = cropHeight;
        }
        
        if (!ctx) {
          reject(new Error('Erro ao criar canvas'));
          return;
        }

        // Apply rotation
        ctx.save();
        if (rotation === 90) {
          ctx.translate(canvas.width, 0);
          ctx.rotate((90 * Math.PI) / 180);
        } else if (rotation === 180) {
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate((180 * Math.PI) / 180);
        } else if (rotation === 270) {
          ctx.translate(0, canvas.height);
          ctx.rotate((270 * Math.PI) / 180);
        }
        
        // Draw cropped area
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );
        ctx.restore();
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(croppedFile);
            } else {
              reject(new Error('Erro ao gerar imagem recortada'));
            }
          },
          'image/jpeg',
          0.92
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Erro ao carregar imagem'));
      };
      img.src = url;
    });
  };

  // Manage Object URLs for thumbnails to prevent memory leaks
  const thumbnailUrls = useMemo(() => {
    return files.map(file => 
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    );
  }, [files]);

  useEffect(() => {
    return () => {
      thumbnailUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [thumbnailUrls]);

  if (files.length === 0) return null;

  const imageCount = files.filter(f => isImageFile(f)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Arquivos Selecionados ({files.length})
        </h3>
        {imageCount >= 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchAutoCrop}
            disabled={batchCropping || autoCroppingIndex !== null}
            className="gap-2"
          >
            {batchCropping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {batchCropping
              ? `Recortando ${batchProgress.current}/${batchProgress.total}...`
              : `Recorte automático (${imageCount} imagens)`}
          </Button>
        )}
      </div>
      
      {batchCropping && (
        <div className="space-y-2">
          <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Processando imagem {batchProgress.current} de {batchProgress.total}...
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {files.map((file, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 rounded-lg bg-muted border border-border transition-all ${
              draggedIndex === index ? 'opacity-50 scale-95' : 'hover:border-accent'
            }`}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
            
            <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-background flex items-center justify-center">
              {thumbnailUrls[index] ? (
                <img
                  src={thumbnailUrls[index]!}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Arquivo'}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {isImageFile(file) && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAutoCrop(index)}
                    disabled={autoCroppingIndex !== null || batchCropping}
                    className="h-8 w-8 text-accent-foreground hover:bg-accent"
                    title="Recorte automático com IA"
                  >
                    {autoCroppingIndex === index ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditImage(index)}
                    className="h-8 w-8 text-primary hover:text-primary"
                    title="Editar imagem (cortar, rotacionar)"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="h-8 w-8"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveDown(index)}
                disabled={index === files.length - 1}
                className="h-8 w-8"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Image Editor Modal */}
      {editingIndex !== null && files[editingIndex] && isImageFile(files[editingIndex]) && (
        <ImageCropEditor
          file={files[editingIndex]}
          isOpen={editingIndex !== null}
          onClose={() => setEditingIndex(null)}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
};
