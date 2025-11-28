import { useCallback, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  files: File[];
}

export const FileUpload = ({ onFilesSelected, files }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesSelected([...files, ...droppedFiles]);
  }, [files, onFilesSelected, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      onFilesSelected([...files, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          isDragging
            ? 'border-accent bg-accent/5 scale-[1.02]'
            : 'border-border hover:border-accent/50 hover:bg-muted/30'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground mb-2">
          Arraste seus arquivos aqui
        </p>
        <p className="text-sm text-muted-foreground">
          ou clique para selecionar (imagens, PDFs, documentos)
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted shadow-card flex items-center justify-center">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground text-center">
                      {file.type || 'Arquivo'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-elegant"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="mt-2 text-xs text-muted-foreground truncate">
                {file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
