import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Folder, FolderPlus, Upload, FileText, Trash2, Download, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Colaborador {
  id: string;
  full_name: string;
}

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

export function RHDocumentos() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [selectedColaborador, setSelectedColaborador] = useState<string>('');
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pastaDialogOpen, setPastaDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [novaPasta, setNovaPasta] = useState({ nome: '', descricao: '' });
  const [selectedPasta, setSelectedPasta] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchColaboradores();
  }, []);

  useEffect(() => {
    if (selectedColaborador) {
      fetchPastas();
      fetchDocumentos();
    }
  }, [selectedColaborador]);

  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('approval_status', 'approved')
        .order('full_name');

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  };

  const fetchPastas = async () => {
    try {
      const { data, error } = await supabase
        .from('rh_pastas_documentos')
        .select('*')
        .eq('colaborador_id', selectedColaborador)
        .order('nome');

      if (error) throw error;
      setPastas(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar pastas');
    }
  };

  const fetchDocumentos = async () => {
    try {
      const { data: docsData, error } = await supabase
        .from('rh_documentos')
        .select('*')
        .eq('colaborador_id', selectedColaborador)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch pastas separately
      const pastaIds = [...new Set((docsData || []).filter(d => d.pasta_id).map(d => d.pasta_id))];
      let pastasMap = new Map();
      
      if (pastaIds.length > 0) {
        const { data: pastasData } = await supabase
          .from('rh_pastas_documentos')
          .select('id, nome')
          .in('id', pastaIds);
        pastasMap = new Map((pastasData || []).map(p => [p.id, p]));
      }

      const docsWithPastas = (docsData || []).map(d => ({
        ...d,
        rh_pastas_documentos: d.pasta_id ? pastasMap.get(d.pasta_id) || null : null
      }));

      setDocumentos(docsWithPastas as Documento[]);
    } catch (error: any) {
      toast.error('Erro ao carregar documentos');
    }
  };

  const handleCriarPasta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaborador) return;

    try {
      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('rh_pastas_documentos')
        .insert({
          colaborador_id: selectedColaborador,
          nome: novaPasta.nome,
          descricao: novaPasta.descricao || null,
          created_by: user.user?.id
        });

      if (error) throw error;

      toast.success('Pasta criada com sucesso!');
      setPastaDialogOpen(false);
      setNovaPasta({ nome: '', descricao: '' });
      fetchPastas();
    } catch (error: any) {
      toast.error('Erro ao criar pasta: ' + error.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedColaborador) return;

    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedColaborador}/${Date.now()}_${file.name}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('rh-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('rh-documents')
        .getPublicUrl(fileName);

      // Salvar no banco
      const { error: dbError } = await supabase
        .from('rh_documentos')
        .insert({
          colaborador_id: selectedColaborador,
          pasta_id: selectedPasta || null,
          nome: file.name,
          arquivo_url: urlData.publicUrl,
          tipo_arquivo: file.type,
          tamanho_bytes: file.size,
          created_by: user.user?.id
        });

      if (dbError) throw dbError;

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

  const handleDeleteDoc = async (doc: Documento) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      const { error } = await supabase
        .from('rh_documentos')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Documento excluído!');
      fetchDocumentos();
    } catch (error: any) {
      toast.error('Erro ao excluir documento');
    }
  };

  const handleDeletePasta = async (pasta: Pasta) => {
    if (!confirm(`Tem certeza que deseja excluir a pasta "${pasta.nome}"? Os documentos serão mantidos sem pasta.`)) return;

    try {
      const { error } = await supabase
        .from('rh_pastas_documentos')
        .delete()
        .eq('id', pasta.id);

      if (error) throw error;

      toast.success('Pasta excluída!');
      fetchPastas();
    } catch (error: any) {
      toast.error('Erro ao excluir pasta');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Seleção de Colaborador */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 max-w-md">
              <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedColaborador && (
        <>
          {/* Pastas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Pastas
              </CardTitle>
              <Dialog open={pastaDialogOpen} onOpenChange={setPastaDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nova Pasta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Pasta</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCriarPasta} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da Pasta</Label>
                      <Input
                        value={novaPasta.nome}
                        onChange={(e) => setNovaPasta({ ...novaPasta, nome: e.target.value })}
                        placeholder="Ex: Documentos Médicos"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Input
                        value={novaPasta.descricao}
                        onChange={(e) => setNovaPasta({ ...novaPasta, descricao: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPastaDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Criar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {pastas.map(pasta => (
                  <Badge key={pasta.id} variant="secondary" className="px-3 py-1.5 text-sm flex items-center gap-2">
                    <Folder className="h-3 w-3" />
                    {pasta.nome}
                    <button onClick={() => handleDeletePasta(pasta)} className="hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {pastas.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhuma pasta criada</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </CardTitle>
              <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
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
                      <Select value={selectedPasta} onValueChange={setSelectedPasta}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sem pasta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sem pasta</SelectItem>
                          {pastas.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo</Label>
                      <Input
                        type="file"
                        onChange={handleUpload}
                        disabled={uploading}
                      />
                    </div>
                    {uploading && (
                      <p className="text-sm text-muted-foreground">Enviando...</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pasta</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.rh_pastas_documentos?.nome || '-'}
                      </TableCell>
                      <TableCell>{formatFileSize(doc.tamanho_bytes)}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteDoc(doc)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {documentos.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum documento encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
