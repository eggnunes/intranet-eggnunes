import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Download, Trash2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Document {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
  uploaded_by: string;
  profiles: {
    full_name: string;
  };
}

export default function DocumentosUteis() {
  const { isApproved, isAdmin, loading } = useUserRole();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isApproved) {
      fetchDocuments();
    }
  }, [isApproved]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('useful_documents')
      .select(`
        *,
        profiles:uploaded_by(full_name)
      `)
      .order('created_at', { ascending: false });

    setDocuments(data as any || []);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Criar registro
      const { error: insertError } = await supabase
        .from('useful_documents')
        .insert({
          title: newTitle,
          description: newDescription,
          file_url: urlData.publicUrl,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Documento adicionado',
        description: 'O documento foi adicionado com sucesso',
      });

      setNewTitle('');
      setNewDescription('');
      setFile(null);
      setShowAddDialog(false);
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    try {
      // Extrair nome do arquivo da URL
      const fileName = fileUrl.split('/').pop();
      
      // Deletar arquivo do storage
      if (fileName) {
        await supabase.storage.from('documents').remove([fileName]);
      }

      // Deletar registro
      const { error } = await supabase
        .from('useful_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Documento deletado',
        description: 'O documento foi removido com sucesso',
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!isApproved) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Acesso negado</CardTitle>
              <CardDescription>
                Você precisa de aprovação para acessar esta seção
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Documentos Úteis</h1>
            <p className="text-muted-foreground text-lg">
              Manuais, escalas e documentos importantes do escritório
            </p>
          </div>
          {isAdmin && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Documento</DialogTitle>
                  <DialogDescription>
                    Faça upload de um novo documento útil para a equipe
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Manual do Escritório"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      disabled={uploading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descrição do documento"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      disabled={uploading}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Arquivo</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                      disabled={uploading}
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={uploading || !file}>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Enviando...' : 'Adicionar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum documento disponível ainda
                </p>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{doc.title}</CardTitle>
                      {doc.description && (
                        <CardDescription className="mt-2 line-clamp-2">
                          {doc.description}
                        </CardDescription>
                      )}
                    </div>
                    <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-4">
                    Enviado por {doc.profiles?.full_name}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(doc.id, doc.file_url)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
