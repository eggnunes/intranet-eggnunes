import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTeamsUpload } from '@/hooks/useTeamsUpload';
import { Loader2, Upload, FolderPlus, Check, CloudUpload, Folder } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SaveToTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileContent: string; // Base64 encoded PDF content
  onSuccess?: (webUrl: string) => void;
}

interface FolderItem {
  id: string;
  name: string;
  folder?: object;
}

export function SaveToTeamsDialog({
  open,
  onOpenChange,
  fileName,
  fileContent,
  onSuccess,
}: SaveToTeamsDialogProps) {
  const {
    uploading,
    sites,
    drives,
    loadingSites,
    loadingDrives,
    loadSites,
    loadDrives,
    uploadFile,
    createFolder,
    listItems,
  } = useTeamsUpload();

  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedDrive, setSelectedDrive] = useState<string>('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderPath, setFolderPath] = useState<{ id?: string; name: string }[]>([{ name: 'Raiz' }]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // Load sites on mount
  useEffect(() => {
    if (open && sites.length === 0) {
      loadSites().catch(console.error);
    }
  }, [open]);

  // Load drives when site is selected
  useEffect(() => {
    if (selectedSite) {
      loadDrives(selectedSite).catch(console.error);
      setSelectedDrive('');
      setCurrentFolderId(undefined);
      setFolders([]);
      setFolderPath([{ name: 'Raiz' }]);
    }
  }, [selectedSite]);

  // Load folders when drive is selected or folder changes
  useEffect(() => {
    if (selectedDrive) {
      loadFolders();
    }
  }, [selectedDrive, currentFolderId]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const items = await listItems(selectedDrive, currentFolderId);
      const folderItems = items.filter((item: FolderItem) => item.folder);
      setFolders(folderItems);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const navigateToFolder = (folder: FolderItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const navigateBack = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1]?.id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      const result = await createFolder(selectedDrive, newFolderName.trim(), currentFolderId);
      if (result.success) {
        toast.success('Pasta criada com sucesso!');
        setNewFolderName('');
        setShowNewFolder(false);
        loadFolders();
      } else {
        toast.error(result.error || 'Erro ao criar pasta');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar pasta');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedDrive) {
      toast.error('Selecione um local para salvar');
      return;
    }

    const result = await uploadFile(selectedDrive, fileName, fileContent, currentFolderId);
    
    if (result.success) {
      setUploadSuccess(true);
      setUploadedUrl(result.webUrl || null);
      toast.success('Documento salvo no Teams com sucesso!');
      onSuccess?.(result.webUrl || '');
    } else {
      toast.error(result.error || 'Erro ao salvar documento');
    }
  };

  const handleClose = () => {
    setUploadSuccess(false);
    setUploadedUrl(null);
    setSelectedSite('');
    setSelectedDrive('');
    setCurrentFolderId(undefined);
    setFolders([]);
    setFolderPath([{ name: 'Raiz' }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" />
            Salvar no Teams/SharePoint
          </DialogTitle>
          <DialogDescription>
            Salve o documento "{fileName}" diretamente no SharePoint.
          </DialogDescription>
        </DialogHeader>

        {uploadSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Documento salvo com sucesso!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O arquivo foi enviado para o SharePoint.
              </p>
            </div>
            {uploadedUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(uploadedUrl, '_blank')}
              >
                Abrir no SharePoint
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Site Selection */}
            <div className="space-y-2">
              <Label>Site do Teams</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite} disabled={loadingSites}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSites ? 'Carregando...' : 'Selecione um site'} />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drive Selection */}
            {selectedSite && (
              <div className="space-y-2">
                <Label>Biblioteca de Documentos</Label>
                <Select value={selectedDrive} onValueChange={setSelectedDrive} disabled={loadingDrives}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDrives ? 'Carregando...' : 'Selecione uma biblioteca'} />
                  </SelectTrigger>
                  <SelectContent>
                    {drives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id}>
                        {drive.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Folder Navigation */}
            {selectedDrive && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pasta de destino</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewFolder(!showNewFolder)}
                    className="h-7 text-xs"
                  >
                    <FolderPlus className="h-3 w-3 mr-1" />
                    Nova pasta
                  </Button>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
                  {folderPath.map((item, index) => (
                    <span key={index} className="flex items-center">
                      {index > 0 && <span className="mx-1">/</span>}
                      <button
                        onClick={() => navigateBack(index)}
                        className="hover:text-foreground hover:underline"
                      >
                        {item.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* New Folder Input */}
                {showNewFolder && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da nova pasta"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateFolder}
                      disabled={creatingFolder || !newFolderName.trim()}
                      className="h-8"
                    >
                      {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Criar'}
                    </Button>
                  </div>
                )}

                {/* Folder List */}
                <ScrollArea className="h-[150px] border rounded-md">
                  {loadingFolders ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                      <Folder className="h-8 w-8 mb-2 opacity-50" />
                      <p>Nenhuma subpasta</p>
                      <p className="text-xs">O arquivo será salvo aqui</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => navigateToFolder(folder)}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm"
                        >
                          <Folder className="h-4 w-4 text-blue-500" />
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {uploadSuccess ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedDrive}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Salvar no Teams
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
