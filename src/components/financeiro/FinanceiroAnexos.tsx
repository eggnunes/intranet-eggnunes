import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Download, Eye, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinanceiroAnexosProps {
  lancamentoId: string;
  readonly?: boolean;
}

export function FinanceiroAnexos({ lancamentoId, readonly = false }: FinanceiroAnexosProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: anexos, isLoading } = useQuery({
    queryKey: ['fin-anexos', lancamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_anexos')
        .select('*')
        .eq('lancamento_id', lancamentoId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!lancamentoId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${lancamentoId}/${Date.now()}.${fileExt}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Salvar registro no banco
      const { error: dbError } = await supabase
        .from('fin_anexos')
        .insert({
          lancamento_id: lancamentoId,
          nome_arquivo: file.name,
          url_arquivo: urlData.publicUrl,
          tipo_arquivo: file.type,
          tamanho: file.size,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fin-anexos', lancamentoId] });
      toast.success('Arquivo anexado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao anexar arquivo:', error);
      toast.error('Erro ao anexar arquivo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (anexoId: string) => {
      const { error } = await supabase
        .from('fin_anexos')
        .delete()
        .eq('id', anexoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fin-anexos', lancamentoId] });
      toast.success('Anexo removido!');
    },
    onError: () => {
      toast.error('Erro ao remover anexo');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (tipo: string | null) => {
    if (tipo?.includes('pdf')) return '📄';
    if (tipo?.includes('image')) return '🖼️';
    if (tipo?.includes('spreadsheet') || tipo?.includes('excel')) return '📊';
    if (tipo?.includes('document') || tipo?.includes('word')) return '📝';
    return '📎';
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando anexos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Anexos ({anexos?.length || 0})
        </h4>
        {!readonly && (
          <div>
            <Input
              type="file"
              id={`file-upload-${lancamentoId}`}
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            />
            <label htmlFor={`file-upload-${lancamentoId}`}>
              <Button 
                variant="outline" 
                size="sm" 
                asChild 
                disabled={uploading}
              >
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Enviando...' : 'Anexar'}
                </span>
              </Button>
            </label>
          </div>
        )}
      </div>

      {anexos && anexos.length > 0 ? (
        <div className="space-y-2">
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg">{getFileIcon(anexo.tipo_arquivo)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{anexo.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(anexo.tamanho)} • {format(new Date(anexo.created_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPreviewUrl(anexo.url_arquivo)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>{anexo.nome_arquivo}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center">
                      {anexo.tipo_arquivo?.includes('image') ? (
                        <img 
                          src={anexo.url_arquivo} 
                          alt={anexo.nome_arquivo}
                          className="max-h-[70vh] object-contain"
                        />
                      ) : anexo.tipo_arquivo?.includes('pdf') ? (
                        <iframe
                          src={anexo.url_arquivo}
                          className="w-full h-[70vh]"
                          title={anexo.nome_arquivo}
                        />
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                          <p className="mt-2">Visualização não disponível</p>
                          <a 
                            href={anexo.url_arquivo} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Abrir em nova aba
                          </a>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={anexo.url_arquivo} download={anexo.nome_arquivo} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>

                {!readonly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(anexo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum anexo ainda
        </p>
      )}
    </div>
  );
}
