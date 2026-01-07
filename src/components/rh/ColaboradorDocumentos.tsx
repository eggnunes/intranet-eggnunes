import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Folder, FolderPlus, Upload, FileText, Trash2, Download, File, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Pasta {
  id: string;
  colaborador_id: string;
  nome: string;
  descricao: string | null;
}

interface Documento {
  id: string;
  colaborador_id: string;
  pasta_id: string | null;
  nome: string;
  arquivo_url: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  created_at: string;
  rh_pastas_documentos?: { nome: string } | null;
}

interface ColaboradorDocumentosProps {
  colaboradorId: string;
  colaboradorNome?: string;
  readOnly?: boolean;
  compact?: boolean;
}

export function ColaboradorDocumentos({ 
  colaboradorId, 
  colaboradorNome,
  readOnly = false,
  compact = false
}: ColaboradorDocumentosProps) {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pastaDialogOpen, setPastaDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [novaPasta, setNovaPasta] = useState({ nome: '', descricao: '' });
  const [selectedPasta, setSelectedPasta] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [selectedPastaFilter, setSelectedPastaFilter] = useState<string | null>(null);

  useEffect(() => {
    if (colaboradorId) {
      fetchPastas();
      fetchDocumentos();
    }
  }, [colaboradorId]);

  const fetchPastas = async () => {
    try {
      const { data, error } = await supabase
        .from('rh_pastas_documentos')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('nome');

      if (error) throw error;
      setPastas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar pastas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentos = async () => {
    try {
      const { data: docsData, error } = await supabase
        .from('rh_documentos')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar nomes das pastas
      const pastaIds = [...new Set((docsData || []).filter(d => d.pasta_id).map(d => d.pasta_id))];
      let pastasMap = new Map();
      
      if (pastaIds.length > 0) {
        const { data: pastasData } = await supabase
          .from('rh_pastas_documentos')
          .select('id, nome')
          .in('id', pastaIds);
        
        pastasMap = new Map((pastasData || []).map(p => [p.id, p]));
      }

      const docsWithPastas = (docsData || []).map(doc => ({
        ...doc,
        rh_pastas_documentos: doc.pasta_id ? pastasMap.get(doc.pasta_id) : null
      }));

      setDocumentos(docsWithPastas);
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  const handleCriarPasta = async () => {
    if (!novaPasta.nome.trim()) {
      toast.error('Nome da pasta é obrigatório');
      return;
    }

    try {
      const { error } = await supabase
        .from('rh_pastas_documentos')
        .insert({
          colaborador_id: colaboradorId,
          nome: novaPasta.nome,
          descricao: novaPasta.descricao || null
        });

      if (error) throw error;

      toast.success('Pasta criada com sucesso!');
      setNovaPasta({ nome: '', descricao: '' });
      setPastaDialogOpen(false);
      fetchPastas();
    } catch (error: any) {
      toast.error('Erro ao criar pasta: ' + error.message);
    }
  };

  const handleUploadDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${colaboradorId}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('rh-documentos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rh-documentos')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('rh_documentos')
        .insert({
          colaborador_id: colaboradorId,
          pasta_id: selectedPasta || null,
          nome: file.name,
          arquivo_url: publicUrl,
          tipo_arquivo: file.type,
          tamanho_bytes: file.size
        });

      if (insertError) throw insertError;

      toast.success('Documento enviado com sucesso!');
      setDocDialogOpen(false);
      setSelectedPasta('');
      fetchDocumentos();
    } catch (error: any) {
      toast.error('Erro ao enviar documento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocumento = async (doc: Documento) => {
    if (!confirm(`Deseja excluir o documento "${doc.nome}"?`)) return;

    try {
      // Extrair path do storage da URL
      const urlParts = doc.arquivo_url.split('/rh-documentos/');
      if (urlParts.length > 1) {
        await supabase.storage.from('rh-documentos').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('rh_documentos')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Documento excluído com sucesso!');
      fetchDocumentos();
    } catch (error: any) {
      toast.error('Erro ao excluir documento: ' + error.message);
    }
  };

  const handleDeletePasta = async (pasta: Pasta) => {
    const docsInPasta = documentos.filter(d => d.pasta_id === pasta.id);
    if (docsInPasta.length > 0) {
      toast.error('Remova todos os documentos da pasta antes de excluí-la');
      return;
    }

    if (!confirm(`Deseja excluir a pasta "${pasta.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('rh_pastas_documentos')
        .delete()
        .eq('id', pasta.id);

      if (error) throw error;

      toast.success('Pasta excluída com sucesso!');
      fetchPastas();
    } catch (error: any) {
      toast.error('Erro ao excluir pasta: ' + error.message);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <File className="h-4 w-4" />;
    if (tipo.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (tipo.includes('image')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (tipo.includes('word') || tipo.includes('document')) return <FileText className="h-4 w-4 text-blue-600" />;
    return <File className="h-4 w-4" />;
  };

  const filteredDocumentos = selectedPastaFilter === null 
    ? documentos 
    : selectedPastaFilter === 'sem-pasta' 
      ? documentos.filter(d => !d.pasta_id)
      : documentos.filter(d => d.pasta_id === selectedPastaFilter);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Carregando documentos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos {colaboradorNome && `de ${colaboradorNome}`}
            </CardTitle>
            <CardDescription>
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} em {pastas.length} pasta{pastas.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Dialog open={pastaDialogOpen} onOpenChange={setPastaDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nova Pasta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Pasta</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Pasta</Label>
                      <Input
                        value={novaPasta.nome}
                        onChange={(e) => setNovaPasta({ ...novaPasta, nome: e.target.value })}
                        placeholder="Ex: Contratos, Certificados..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Input
                        value={novaPasta.descricao}
                        onChange={(e) => setNovaPasta({ ...novaPasta, descricao: e.target.value })}
                        placeholder="Descrição da pasta"
                      />
                    </div>
                    <Button onClick={handleCriarPasta} className="w-full">
                      Criar Pasta
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Documento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar Documento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pasta (opcional)</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedPasta}
                        onChange={(e) => setSelectedPasta(e.target.value)}
                      >
                        <option value="">Sem pasta</option>
                        {pastas.map(pasta => (
                          <option key={pasta.id} value={pasta.id}>{pasta.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo</Label>
                      <Input
                        type="file"
                        onChange={handleUploadDocumento}
                        disabled={uploading}
                      />
                      {uploading && (
                        <p className="text-sm text-muted-foreground">Enviando...</p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtro por pasta */}
        {pastas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge 
              variant={selectedPastaFilter === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedPastaFilter(null)}
            >
              Todos ({documentos.length})
            </Badge>
            <Badge 
              variant={selectedPastaFilter === 'sem-pasta' ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedPastaFilter('sem-pasta')}
            >
              Sem pasta ({documentos.filter(d => !d.pasta_id).length})
            </Badge>
            {pastas.map(pasta => (
              <Badge 
                key={pasta.id}
                variant={selectedPastaFilter === pasta.id ? "default" : "outline"}
                className="cursor-pointer flex items-center gap-1"
                onClick={() => setSelectedPastaFilter(pasta.id)}
              >
                <Folder className="h-3 w-3" />
                {pasta.nome} ({documentos.filter(d => d.pasta_id === pasta.id).length})
                {!readOnly && documentos.filter(d => d.pasta_id === pasta.id).length === 0 && (
                  <Trash2 
                    className="h-3 w-3 ml-1 text-destructive hover:text-destructive/80"
                    onClick={(e) => { e.stopPropagation(); handleDeletePasta(pasta); }}
                  />
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Lista de documentos */}
        {filteredDocumentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum documento encontrado</p>
            {!readOnly && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setDocDialogOpen(true)}
              >
                Enviar primeiro documento
              </Button>
            )}
          </div>
        ) : (
          <div className={`space-y-2 ${compact ? 'max-h-[300px] overflow-y-auto' : ''}`}>
            {filteredDocumentos.map(doc => (
              <div 
                key={doc.id} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.tipo_arquivo)}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.rh_pastas_documentos && (
                        <span className="flex items-center gap-1">
                          <Folder className="h-3 w-3" />
                          {doc.rh_pastas_documentos.nome}
                        </span>
                      )}
                      <span>{formatFileSize(doc.tamanho_bytes)}</span>
                      <span>{format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(doc.arquivo_url, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a href={doc.arquivo_url} download={doc.nome}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteDocumento(doc)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
