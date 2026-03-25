import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamsUpload } from '@/hooks/useTeamsUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FolderPlus, CheckCircle, AlertCircle, Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function CriarPastaCliente() {
  const navigate = useNavigate();
  const { sites, drives, loadingSites, loadingDrives, loadSites, loadDrives, findFolderByPath, createFolderByPath } = useTeamsUpload();

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [clientName, setClientName] = useState('');
  const [basePath] = useState('Operacional - Clientes');
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ type: 'exists' | 'created' | 'error'; message: string; webUrl?: string } | null>(null);

  useEffect(() => {
    loadSites().catch(() => toast.error('Erro ao carregar sites do Teams'));
  }, []);

  // Auto-select Jurídico site
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      const juridico = sites.find(s => s.displayName?.toLowerCase().includes('jurídico') || s.displayName?.toLowerCase().includes('juridico'));
      if (juridico) setSelectedSiteId(juridico.id);
    }
  }, [sites]);

  useEffect(() => {
    if (selectedSiteId) {
      loadDrives(selectedSiteId).then(drivesList => {
        if (drivesList?.length > 0) {
          const docs = drivesList.find((d: any) => d.name === 'Documentos' || d.name === 'Documents');
          setSelectedDriveId(docs?.id || drivesList[0].id);
        }
      }).catch(() => toast.error('Erro ao carregar drives'));
    }
  }, [selectedSiteId]);

  const handleCreate = async () => {
    if (!clientName.trim()) {
      toast.error('Digite o nome do cliente');
      return;
    }
    if (!selectedDriveId) {
      toast.error('Selecione um site e drive');
      return;
    }

    const fullPath = `${basePath}/${clientName.trim()}`;
    setResult(null);
    setChecking(true);

    try {
      const existing = await findFolderByPath(selectedDriveId, fullPath);
      if (existing.found) {
        setResult({
          type: 'exists',
          message: `Já existe uma pasta para "${clientName.trim()}" neste local.`,
          webUrl: existing.item?.webUrl,
        });
        setChecking(false);
        return;
      }
    } catch {
      // continue to create
    }

    setChecking(false);
    setCreating(true);

    try {
      const res = await createFolderByPath(selectedDriveId, fullPath);
      if (res.success) {
        setResult({
          type: 'created',
          message: `Pasta "${clientName.trim()}" criada com sucesso!`,
          webUrl: res.folder?.webUrl,
        });
        toast.success('Pasta criada com sucesso!');
      } else {
        setResult({ type: 'error', message: res.error || 'Erro ao criar pasta' });
        toast.error('Erro ao criar pasta');
      }
    } catch (err: any) {
      setResult({ type: 'error', message: err.message || 'Erro inesperado' });
    } finally {
      setCreating(false);
    }
  };

  const loading = checking || creating;

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FolderPlus className="h-6 w-6 text-primary" />
        Criar Pasta de Cliente
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova Pasta no Teams</CardTitle>
          <CardDescription>
            Crie uma pasta para o cliente dentro do SharePoint/Teams. O sistema verifica automaticamente se já existe uma pasta com o mesmo nome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Site</Label>
            <Select value={selectedSiteId} onValueChange={v => { setSelectedSiteId(v); setSelectedDriveId(''); setResult(null); }}>
              <SelectTrigger>
                <SelectValue placeholder={loadingSites ? 'Carregando...' : 'Selecione o site'} />
              </SelectTrigger>
              <SelectContent>
                {sites.map(site => (
                  <SelectItem key={site.id} value={site.id}>{site.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {drives.length > 1 && (
            <div className="space-y-2">
              <Label>Drive</Label>
              <Select value={selectedDriveId} onValueChange={v => { setSelectedDriveId(v); setResult(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingDrives ? 'Carregando...' : 'Selecione o drive'} />
                </SelectTrigger>
                <SelectContent>
                  {drives.map(drive => (
                    <SelectItem key={drive.id} value={drive.id}>{drive.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome do Cliente</Label>
            <Input
              placeholder="Ex: João da Silva"
              value={clientName}
              onChange={e => { setClientName(e.target.value); setResult(null); }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            📂 Caminho: <strong>{basePath}/{clientName.trim() || '...'}</strong>
          </div>

          <Button onClick={handleCreate} disabled={loading || !clientName.trim() || !selectedDriveId} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
            {checking ? 'Verificando...' : creating ? 'Criando...' : 'Criar Pasta'}
          </Button>

          {result && (
            <Alert variant={result.type === 'error' ? 'destructive' : 'default'} className={result.type === 'created' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : result.type === 'exists' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
              {result.type === 'created' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{result.type === 'created' ? 'Sucesso!' : result.type === 'exists' ? 'Pasta já existe' : 'Erro'}</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {result.message}
                {result.webUrl && (
                  <a href={result.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium">
                    <ExternalLink className="h-3 w-3" /> Abrir no Teams
                  </a>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
