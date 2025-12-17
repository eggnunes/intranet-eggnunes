import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Folder,
  File,
  Download,
  Upload,
  Trash2,
  FolderPlus,
  Search,
  RefreshCw,
  ChevronRight,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  HardDrive,
  Building2,
  Lock,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc' | 'type';

interface Site {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

interface Drive {
  id: string;
  name: string;
  driveType: string;
  quota?: {
    total: number;
    used: number;
  };
}

interface DriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  '@microsoft.graph.downloadUrl'?: string;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function ArquivosTeams() {
  const { isAdmin } = useUserRole();
  const [sites, setSites] = useState<Site[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: 'Raiz' }]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamsPermission, setTeamsPermission] = useState<string>('view');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadTeamsPermission();
  }, []);

  useEffect(() => {
    if (teamsPermission) {
      loadSites();
    }
  }, [teamsPermission]);

  const loadTeamsPermission = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verificar se é admin/sócio (têm permissão total)
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, position')
        .eq('id', user.id)
        .single();

      if (profile?.email === 'rafael@eggnunes.com.br' || profile?.position === 'socio') {
        setTeamsPermission('edit');
        return;
      }

      // Verificar permissão individual
      const { data: adminPerm } = await supabase
        .from('admin_permissions')
        .select('perm_teams')
        .eq('admin_user_id', user.id)
        .single();

      if (adminPerm?.perm_teams) {
        setTeamsPermission(adminPerm.perm_teams);
        return;
      }

      // Verificar permissão do grupo (cargo)
      const { data: groupPerm } = await supabase
        .from('position_permission_defaults')
        .select('perm_teams')
        .eq('position', profile?.position || '')
        .single();

      if (groupPerm?.perm_teams) {
        setTeamsPermission(groupPerm.perm_teams);
      }
    } catch (error) {
      console.error('Error loading teams permission:', error);
    }
  };

  const callTeamsApi = async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('microsoft-teams', {
      body: { action, ...params },
    });

    if (error) throw error;
    return data;
  };

  // Sites públicos (todos podem acessar com view ou edit)
  const PUBLIC_SITES = [
    'comercial',
    'juridico',
    'jurídico',
    'eggnunesadvogadosassociados',
    'egg nunes advogados associados',
  ];

  // Sites restritos (somente admins/edit podem acessar)
  const RESTRICTED_SITES = [
    'administrativo',
    'estrategico',
    'estratégico',
  ];

  const isSiteRestricted = (site: Site): boolean => {
    const siteName = site.name?.toLowerCase() || '';
    const displayName = site.displayName?.toLowerCase() || '';
    
    return RESTRICTED_SITES.some(restricted => 
      siteName.includes(restricted) || displayName.includes(restricted)
    );
  };

  const loadSites = async () => {
    setLoading(true);
    try {
      const data = await callTeamsApi('list-sites');
      const allSites = data.value || [];
      
      // Todos os sites permitidos
      const ALL_ALLOWED_SITES = [...PUBLIC_SITES, ...RESTRICTED_SITES];
      
      // Filtrar apenas os sites permitidos
      const filteredSites = allSites.filter((site: Site) => {
        const siteName = site.name?.toLowerCase() || '';
        const displayName = site.displayName?.toLowerCase() || '';
        
        const isAllowed = ALL_ALLOWED_SITES.some(allowed => 
          siteName.includes(allowed) || displayName.includes(allowed)
        );
        
        if (!isAllowed) return false;
        
        // Se o site é restrito, verificar se usuário tem permissão 'edit'
        if (isSiteRestricted(site)) {
          return teamsPermission === 'edit';
        }
        
        return true;
      });
      
      setSites(filteredSites);
    } catch (error) {
      console.error('Error loading sites:', error);
      toast.error('Erro ao carregar sites do Teams');
    } finally {
      setLoading(false);
    }
  };

  const loadDrives = async (site: Site) => {
    setLoading(true);
    setSelectedSite(site);
    setSelectedDrive(null);
    setItems([]);
    setBreadcrumb([{ id: null, name: 'Raiz' }]);
    
    try {
      const data = await callTeamsApi('list-drives', { siteId: site.id });
      setDrives(data.value || []);
    } catch (error) {
      console.error('Error loading drives:', error);
      toast.error('Erro ao carregar drives');
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (drive: Drive, folderId: string | null = null, folderName?: string) => {
    setLoading(true);
    setSelectedDrive(drive);
    setCurrentFolderId(folderId);
    
    if (folderId && folderName) {
      setBreadcrumb(prev => [...prev, { id: folderId, name: folderName }]);
    } else if (!folderId) {
      setBreadcrumb([{ id: null, name: 'Raiz' }]);
    }
    
    try {
      const data = await callTeamsApi('list-items', { 
        driveId: drive.id, 
        folderId 
      });
      setItems(data.value || []);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    const item = breadcrumb[index];
    setBreadcrumb(prev => prev.slice(0, index + 1));
    setCurrentFolderId(item.id);
    
    if (selectedDrive) {
      loadItemsWithoutBreadcrumb(selectedDrive, item.id);
    }
  };

  const loadItemsWithoutBreadcrumb = async (drive: Drive, folderId: string | null) => {
    setLoading(true);
    try {
      const data = await callTeamsApi('list-items', { 
        driveId: drive.id, 
        folderId 
      });
      setItems(data.value || []);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: DriveItem) => {
    if (item.folder && selectedDrive) {
      loadItems(selectedDrive, item.id, item.name);
    } else if (!item.folder) {
      // Clicar em arquivo abre pré-visualização
      handlePreview(item);
    }
  };

  const handleDownload = async (item: DriveItem) => {
    if (!selectedDrive) return;
    
    try {
      const data = await callTeamsApi('download', {
        driveId: selectedDrive.id,
        itemId: item.id,
      });
      
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handleDelete = async (item: DriveItem) => {
    if (!selectedDrive) return;
    
    if (!confirm(`Tem certeza que deseja excluir "${item.name}"?`)) return;
    
    try {
      await callTeamsApi('delete', {
        driveId: selectedDrive.id,
        itemId: item.id,
      });
      
      toast.success('Item excluído com sucesso');
      loadItemsWithoutBreadcrumb(selectedDrive, currentFolderId);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir item');
    }
  };

  const handleCreateFolder = async () => {
    if (!selectedDrive || !newFolderName.trim()) return;
    
    try {
      await callTeamsApi('create-folder', {
        driveId: selectedDrive.id,
        folderId: currentFolderId,
        folderName: newFolderName.trim(),
      });
      
      toast.success('Pasta criada com sucesso');
      setNewFolderName('');
      setShowNewFolderDialog(false);
      loadItemsWithoutBreadcrumb(selectedDrive, currentFolderId);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Erro ao criar pasta');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDrive || !event.target.files?.length) return;
    
    const file = event.target.files[0];
    
    // Limite de 250MB para upload
    if (file.size > 250 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo: 250MB');
      return;
    }
    
    setUploading(true);
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    toast.info(`Enviando arquivo (${fileSizeMB}MB)... Aguarde.`);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        
        await callTeamsApi('upload', {
          driveId: selectedDrive.id,
          folderId: currentFolderId,
          fileName: file.name,
          fileContent: base64,
        });
        
        toast.success('Arquivo enviado com sucesso');
        loadItemsWithoutBreadcrumb(selectedDrive, currentFolderId);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro ao enviar arquivo');
      setUploading(false);
    }
  };

  const getFileIcon = (item: DriveItem) => {
    if (item.folder) return <Folder className="h-5 w-5 text-yellow-500" />;
    
    const mimeType = item.file?.mimeType || '';
    
    if (mimeType.includes('image')) return <FileImage className="h-5 w-5 text-green-500" />;
    if (mimeType.includes('video')) return <FileVideo className="h-5 w-5 text-purple-500" />;
    if (mimeType.includes('audio')) return <FileAudio className="h-5 w-5 text-pink-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) 
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('pdf')) 
      return <FileText className="h-5 w-5 text-blue-500" />;
    
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const sortedAndFilteredItems = useMemo(() => {
    let result = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Ordenar
    result.sort((a, b) => {
      // Pastas sempre primeiro
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;

      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'pt-BR');
        case 'name-desc':
          return b.name.localeCompare(a.name, 'pt-BR');
        case 'date-asc':
          return new Date(a.lastModifiedDateTime).getTime() - new Date(b.lastModifiedDateTime).getTime();
        case 'date-desc':
          return new Date(b.lastModifiedDateTime).getTime() - new Date(a.lastModifiedDateTime).getTime();
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'type':
          const extA = a.name.split('.').pop()?.toLowerCase() || '';
          const extB = b.name.split('.').pop()?.toLowerCase() || '';
          return extA.localeCompare(extB);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, sortBy]);

  // Abrir no SharePoint (usando URL de edição)
  const handleOpenInSharePoint = async (item: DriveItem) => {
    if (!selectedDrive) {
      if (item.webUrl) {
        window.open(item.webUrl, '_blank');
      }
      return;
    }
    
    // Tentar obter URL de edição
    try {
      const data = await callTeamsApi('get-edit-url', {
        driveId: selectedDrive.id,
        itemId: item.id,
      });
      
      if (data.editUrl) {
        window.open(data.editUrl, '_blank');
        return;
      }
    } catch (error) {
      console.error('Error getting edit URL:', error);
    }
    
    // Fallback para webUrl
    if (item.webUrl) {
      window.open(item.webUrl, '_blank');
    }
  };

  // Pré-visualizar arquivo
  const handlePreview = async (item: DriveItem) => {
    if (!selectedDrive) return;
    
    setPreviewItem(item);
    setPreviewUrl(null);
    setLoadingPreview(true);
    
    const mimeType = item.file?.mimeType || '';
    
    // Para imagens, vídeos e áudios, precisamos da URL de download
    if (mimeType.includes('image') || mimeType.includes('video') || mimeType.includes('audio')) {
      try {
        const data = await callTeamsApi('download', {
          driveId: selectedDrive.id,
          itemId: item.id,
        });
        
        if (data.downloadUrl) {
          setPreviewUrl(data.downloadUrl);
        }
      } catch (error) {
        console.error('Error getting preview:', error);
        toast.error('Erro ao carregar pré-visualização');
      }
    } else {
      // Para PDFs e Office files, obter URL embeddable do Microsoft Graph
      try {
        const data = await callTeamsApi('get-preview-url', {
          driveId: selectedDrive.id,
          itemId: item.id,
        });
        
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
        }
      } catch (error) {
        console.error('Error getting preview URL:', error);
        // Não mostrar erro, apenas deixar sem preview URL
      }
    }
    
    setLoadingPreview(false);
  };

  // Verificar se arquivo pode ser pré-visualizado inline
  const canPreviewInline = (item: DriveItem): boolean => {
    if (item.folder) return false;
    const mimeType = item.file?.mimeType || '';
    
    // Imagens
    if (mimeType.includes('image')) return true;
    // Vídeos
    if (mimeType.includes('video')) return true;
    // Áudios
    if (mimeType.includes('audio')) return true;
    
    return false;
  };

  // Verificar se é arquivo Office ou PDF (abrir no SharePoint)
  const isOfficeOrPdf = (item: DriveItem): boolean => {
    const name = item.name.toLowerCase();
    const mimeType = item.file?.mimeType || '';
    
    return (
      name.endsWith('.pdf') ||
      name.endsWith('.doc') ||
      name.endsWith('.docx') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.ppt') ||
      name.endsWith('.pptx') ||
      name.endsWith('.odt') ||
      name.endsWith('.ods') ||
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint')
    );
  };

  // Renderizar preview baseado no tipo
  const renderPreview = () => {
    if (!previewItem) return null;
    
    if (loadingPreview) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    const mimeType = previewItem.file?.mimeType || '';
    
    // Para imagens com URL de preview
    if (mimeType.includes('image') && previewUrl) {
      return <img src={previewUrl} alt={previewItem.name} className="max-w-full max-h-[70vh] object-contain" />;
    }
    
    // Para vídeos
    if (mimeType.includes('video') && previewUrl) {
      return (
        <video controls className="max-w-full max-h-[70vh]">
          <source src={previewUrl} type={mimeType} />
          Seu navegador não suporta vídeo.
        </video>
      );
    }
    
    // Para áudios
    if (mimeType.includes('audio') && previewUrl) {
      return (
        <audio controls className="w-full">
          <source src={previewUrl} type={mimeType} />
          Seu navegador não suporta áudio.
        </audio>
      );
    }
    
    // Para PDFs e arquivos Office - usar iframe com URL embeddable
    if (isOfficeOrPdf(previewItem) && previewUrl) {
      return (
        <iframe 
          src={previewUrl} 
          className="w-full h-[70vh] border-0 rounded-lg"
          title={previewItem.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      );
    }
    
    // Fallback - preview não disponível
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-center text-muted-foreground">
          Pré-visualização não disponível para este arquivo.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Se o SharePoint estiver bloqueado pelo navegador, desative o bloqueador de anúncios.
        </p>
      </div>
    );
  };

  // Verificar se usuário pode excluir (admin ou pasta=false)
  const canDeleteItem = (item: DriveItem): boolean => {
    if (item.folder) {
      // Pastas só podem ser excluídas por admins
      return teamsPermission === 'edit';
    }
    // Arquivos podem ser excluídos por qualquer usuário
    return true;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-primary" />
            Arquivos do Teams
          </h1>
          <p className="text-muted-foreground mt-2">
            Acesse e gerencie arquivos do Microsoft Teams
          </p>
        </div>

        {/* Site Selection */}
        {!selectedSite && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Selecione um Site
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum site encontrado</p>
                  <Button onClick={loadSites} variant="outline" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sites.map(site => {
                    const restricted = isSiteRestricted(site);
                    return (
                      <Card
                        key={site.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => loadDrives(site)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Building2 className={`h-10 w-10 ${restricted ? 'text-orange-500' : 'text-primary'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{site.displayName}</p>
                                {restricted && (
                                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{site.name}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Drive Selection */}
        {selectedSite && !selectedDrive && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Selecione um Drive - {selectedSite.displayName}
                </CardTitle>
                <Button variant="outline" onClick={() => setSelectedSite(null)}>
                  Voltar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : drives.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum drive encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drives.map(drive => (
                    <Card
                      key={drive.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => loadItems(drive)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <HardDrive className="h-10 w-10 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{drive.name}</p>
                            <Badge variant="outline" className="mt-1">
                              {drive.driveType}
                            </Badge>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* File Browser */}
        {selectedDrive && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    {selectedDrive.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSelectedDrive(null);
                        setItems([]);
                        setBreadcrumb([{ id: null, name: 'Raiz' }]);
                      }}
                    >
                      Voltar
                    </Button>
                  </div>
                </div>

                {/* Breadcrumb */}
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumb.map((item, index) => (
                      <BreadcrumbItem key={index}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbLink
                          className="cursor-pointer hover:text-primary"
                          onClick={() => navigateToBreadcrumb(index)}
                        >
                          {item.name}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar arquivos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Ordenação */}
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                      <SelectItem value="date-desc">Mais recente</SelectItem>
                      <SelectItem value="date-asc">Mais antigo</SelectItem>
                      <SelectItem value="size-desc">Maior tamanho</SelectItem>
                      <SelectItem value="size-asc">Menor tamanho</SelectItem>
                      <SelectItem value="type">Tipo de arquivo</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Nova Pasta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Nova Pasta</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Nome da pasta"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCreateFolder}>
                            Criar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" disabled={uploading} asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Enviando...' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                      />
                    </label>
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => loadItemsWithoutBreadcrumb(selectedDrive, currentFolderId)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : sortedAndFilteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Pasta vazia</p>
                </div>
              ) : (
                <div className="divide-y">
                  {sortedAndFilteredItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        {getFileIcon(item)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.folder 
                              ? `${item.folder.childCount} itens` 
                              : formatFileSize(item.size)
                            }
                            {' • '}
                            {format(new Date(item.lastModifiedDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {!item.folder && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleOpenInSharePoint(item); }}
                            title="Abrir no SharePoint"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {!item.folder && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                            title="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteItem(item) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            className="text-destructive hover:text-destructive"
                            title={item.folder ? 'Excluir pasta (Admin)' : 'Excluir arquivo'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview Modal */}
        {previewItem && (
          <Dialog open={!!previewItem} onOpenChange={() => { setPreviewItem(null); setPreviewUrl(null); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between pr-8">
                  <span className="truncate">{previewItem.name}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center min-h-[200px]">
                {loadingPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Carregando...</p>
                  </div>
                ) : (
                  renderPreview()
                )}
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" onClick={() => handleOpenInSharePoint(previewItem)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir no SharePoint
                </Button>
                <Button variant="outline" onClick={() => handleDownload(previewItem)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
