import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Trash2, Download, Eye, ShieldAlert, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface DocumentoMedico {
  id: string;
  colaborador_id: string;
  nome: string;
  descricao: string | null;
  arquivo_url: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface ColaboradorDocumentosMedicosProps {
  colaboradorId: string;
  colaboradorNome?: string;
}

export function ColaboradorDocumentosMedicos({ 
  colaboradorId, 
  colaboradorNome 
}: ColaboradorDocumentosMedicosProps) {
  const { user } = useAuth();
  const { isAdmin, profile } = useUserRole();
  const [documentos, setDocumentos] = useState<DocumentoMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [novoDoc, setNovoDoc] = useState({ nome: '', descricao: '' });
  const [canView, setCanView] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canInsert, setCanInsert] = useState(false);

  // Verificar se o usuário é sócio
  const isSocio = profile?.position === 'socio';
  // Verificar se é o próprio colaborador
  const isOwnProfile = user?.id === colaboradorId;

  useEffect(() => {
    // Definir permissões
    setCanView(isSocio || isOwnProfile);
    setCanDelete(isSocio);
    setCanInsert(isAdmin);
  }, [isSocio, isOwnProfile, isAdmin]);

  useEffect(() => {
    if (colaboradorId && canView) {
      fetchDocumentos();
    } else {
      setLoading(false);
    }
  }, [colaboradorId, canView]);

  const fetchDocumentos = async () => {
    try {
      const { data, error } = await supabase
        .from('rh_documentos_medicos')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar documentos médicos:', error);
      // Não mostrar erro se for permissão negada (usuário sem acesso)
      if (!error.message?.includes('permission')) {
        toast.error('Erro ao carregar documentos médicos');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!novoDoc.nome.trim()) {
      toast.error('Informe um nome para o documento');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${colaboradorId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('rh-documentos-medicos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Gerar URL assinada (bucket é privado)
      const { data: signedData } = await supabase.storage
        .from('rh-documentos-medicos')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 ano

      const { error: insertError } = await supabase
        .from('rh_documentos_medicos')
        .insert({
          colaborador_id: colaboradorId,
          nome: novoDoc.nome,
          descricao: novoDoc.descricao || null,
          arquivo_url: signedData?.signedUrl || fileName,
          tipo_arquivo: file.type,
          tamanho_bytes: file.size,
          uploaded_by: user?.id
        });

      if (insertError) throw insertError;

      toast.success('Documento médico enviado com sucesso!');
      setDialogOpen(false);
      setNovoDoc({ nome: '', descricao: '' });
      fetchDocumentos();
    } catch (error: any) {
      console.error('Erro ao enviar documento:', error);
      toast.error('Erro ao enviar documento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentoMedico) => {
    if (!confirm(`Deseja excluir o documento "${doc.nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      // Extrair path do storage
      const urlParts = doc.arquivo_url.split('/rh-documentos-medicos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0]; // Remover query params da URL assinada
        await supabase.storage.from('rh-documentos-medicos').remove([filePath]);
      }

      const { error } = await supabase
        .from('rh_documentos_medicos')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Documento excluído com sucesso!');
      fetchDocumentos();
    } catch (error: any) {
      toast.error('Erro ao excluir documento: ' + error.message);
    }
  };

  const handleView = async (doc: DocumentoMedico) => {
    try {
      // Gerar nova URL assinada para visualização
      const urlParts = doc.arquivo_url.split('/rh-documentos-medicos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0];
        const { data, error } = await supabase.storage
          .from('rh-documentos-medicos')
          .createSignedUrl(filePath, 60 * 60); // 1 hora
        
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
        }
      } else {
        // Fallback para URL direta
        window.open(doc.arquivo_url, '_blank');
      }
    } catch (error: any) {
      toast.error('Erro ao abrir documento: ' + error.message);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Se não pode visualizar, mostrar mensagem de acesso restrito
  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Documentos Médicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              <strong>Acesso Restrito:</strong> Apenas sócios e o próprio colaborador podem visualizar documentos médicos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Carregando documentos médicos...</div>
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
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Documentos Médicos {colaboradorNome && `de ${colaboradorNome}`}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Lock className="h-3 w-3" />
              Documentos sigilosos - Acesso restrito a sócios e próprio colaborador
            </CardDescription>
          </div>
          {canInsert && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Documento Médico</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Este documento será armazenado de forma segura e somente sócios e o próprio colaborador terão acesso.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label>Nome do Documento *</Label>
                    <Input
                      value={novoDoc.nome}
                      onChange={(e) => setNovoDoc({ ...novoDoc, nome: e.target.value })}
                      placeholder="Ex: Atestado Médico, Exame Periódico..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={novoDoc.descricao}
                      onChange={(e) => setNovoDoc({ ...novoDoc, descricao: e.target.value })}
                      placeholder="Observações sobre o documento..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Arquivo</Label>
                    <Input
                      type="file"
                      onChange={handleUpload}
                      disabled={uploading || !novoDoc.nome.trim()}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    {uploading && (
                      <p className="text-sm text-muted-foreground">Enviando...</p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {documentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum documento médico encontrado</p>
            {canInsert && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setDialogOpen(true)}
              >
                Enviar primeiro documento
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map(doc => (
              <div 
                key={doc.id} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.nome}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {doc.descricao && (
                        <span className="truncate max-w-[200px]">{doc.descricao}</span>
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
                    onClick={() => handleView(doc)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(doc)}
                      title="Excluir"
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
