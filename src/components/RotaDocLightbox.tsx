import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, FileText } from 'lucide-react';

interface RotaDocLightboxProps {
  file: File | null;
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RotaDocLightbox = ({ file, imageUrl, isOpen, onClose }: RotaDocLightboxProps) => {
  if (!file) return null;

  const isPdf = file.type === 'application/pdf';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto p-2 flex flex-col items-center">
        <div className="flex items-center justify-between w-full px-2 py-1 mb-1">
          <span className="text-sm font-medium text-foreground truncate max-w-[80%]">
            {file.name}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center overflow-auto w-full" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {isPdf ? (
            <div className="flex flex-col items-center gap-4 p-12 text-muted-foreground">
              <FileText className="w-24 h-24 text-primary" />
              <p className="text-lg font-medium text-foreground">{file.name}</p>
              <p className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={file.name}
              className="max-w-[80vw] max-h-[80vh] object-contain rounded"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
