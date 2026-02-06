import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Crop as CropIcon, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical,
  ZoomIn,
  Check,
  X,
  Maximize2
} from 'lucide-react';

interface ImageCropEditorProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedFile: File) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export const ImageCropEditor = ({ file, isOpen, onClose, onSave }: ImageCropEditorProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Start with a centered crop selection
    setCrop(centerAspectCrop(width, height, aspect || width / height));
  }, [aspect]);

  const rotateImage = (degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360);
  };

  const toggleFlipH = () => setFlipH((prev) => !prev);
  const toggleFlipV = () => setFlipV((prev) => !prev);

  const setAspectRatio = (ratio: number | undefined) => {
    setAspect(ratio);
    if (imgRef.current && ratio) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, ratio));
    } else {
      setCrop(undefined);
    }
  };

  const handleSave = async () => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // If there's a completed crop, use those dimensions
    // Otherwise use the full image
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (completedCrop) {
      sourceX = completedCrop.x * scaleX;
      sourceY = completedCrop.y * scaleY;
      sourceWidth = completedCrop.width * scaleX;
      sourceHeight = completedCrop.height * scaleY;
    }

    // Handle rotation
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    // Calculate canvas size after rotation
    let canvasWidth = sourceWidth;
    let canvasHeight = sourceHeight;

    if (rotation === 90 || rotation === 270) {
      canvasWidth = sourceHeight;
      canvasHeight = sourceWidth;
    }

    canvas.width = canvasWidth * zoom;
    canvas.height = canvasHeight * zoom;

    ctx.save();

    // Move to center for rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply rotation
    ctx.rotate(radians);

    // Apply flips
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Apply zoom
    ctx.scale(zoom, zoom);

    // Draw the cropped/edited image
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -sourceWidth / 2,
      -sourceHeight / 2,
      sourceWidth,
      sourceHeight
    );

    ctx.restore();

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const editedFile = new File([blob], file.name, { type: 'image/png' });
          onSave(editedFile);
          resetEditor();
          onClose();
        }
      },
      'image/png',
      1
    );
  };

  const resetEditor = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setAspect(undefined);
  };

  const handleClose = () => {
    resetEditor();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Editor de Imagem
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted rounded-lg">
            {/* Rotation */}
            <div className="flex items-center gap-1 border-r pr-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => rotateImage(-90)}
                title="Girar 90° anti-horário"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => rotateImage(90)}
                title="Girar 90° horário"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Flip */}
            <div className="flex items-center gap-1 border-r pr-3">
              <Button
                variant={flipH ? "secondary" : "ghost"}
                size="icon"
                onClick={toggleFlipH}
                title="Espelhar horizontalmente"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant={flipV ? "secondary" : "ghost"}
                size="icon"
                onClick={toggleFlipV}
                title="Espelhar verticalmente"
              >
                <FlipVertical className="h-4 w-4" />
              </Button>
            </div>

            {/* Aspect Ratio */}
            <div className="flex items-center gap-1 border-r pr-3">
              <span className="text-xs text-muted-foreground mr-1">Proporção:</span>
              <Button
                variant={aspect === undefined ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAspectRatio(undefined)}
                className="text-xs h-7 px-2"
              >
                Livre
              </Button>
              <Button
                variant={aspect === 1 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAspectRatio(1)}
                className="text-xs h-7 px-2"
              >
                1:1
              </Button>
              <Button
                variant={aspect === 4 / 3 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAspectRatio(4 / 3)}
                className="text-xs h-7 px-2"
              >
                4:3
              </Button>
              <Button
                variant={aspect === 16 / 9 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAspectRatio(16 / 9)}
                className="text-xs h-7 px-2"
              >
                16:9
              </Button>
              <Button
                variant={aspect === 210 / 297 ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAspectRatio(210 / 297)}
                className="text-xs h-7 px-2"
                title="Proporção A4"
              >
                A4
              </Button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={0.5}
                max={2}
                step={0.1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Reset */}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetEditor}
              className="text-xs"
            >
              Resetar
            </Button>
          </div>

          {/* Image Editor Area */}
          <div 
            className="relative flex items-center justify-center bg-muted/50 rounded-lg min-h-[400px] overflow-auto"
            style={{ maxHeight: 'calc(90vh - 280px)' }}
          >
            <div
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                transition: 'transform 0.3s ease',
              }}
            >
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                className="max-w-full"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Editar imagem"
                  onLoad={onImageLoad}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 300px)',
                    objectFit: 'contain',
                  }}
                />
              </ReactCrop>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-3 text-sm text-muted-foreground text-center">
            <Maximize2 className="inline h-4 w-4 mr-1" />
            Clique e arraste na imagem para selecionar a área que deseja recortar.
            Use os botões acima para rotacionar, espelhar ou ajustar a proporção.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4 mr-2" />
            Aplicar Edições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
