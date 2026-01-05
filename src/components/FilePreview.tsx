import { useState } from 'react';
import { Upload, X, GripVertical, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageCropEditor } from './ImageCropEditor';

interface FilePreviewProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export const FilePreview = ({ files, onFilesChange, onRemove }: FilePreviewProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  if (files.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        Arquivos Selecionados ({files.length})
      </h3>
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
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditImage(index)}
                  className="h-8 w-8 text-primary hover:text-primary"
                  title="Editar imagem (cortar, rotacionar)"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
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
