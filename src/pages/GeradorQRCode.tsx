import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  QrCode, 
  Download, 
  Copy, 
  Trash2, 
  Link2, 
  History, 
  Plus,
  ExternalLink,
  User,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface QRCodeRecord {
  id: string;
  url: string;
  title: string | null;
  created_at: string;
  created_by: string;
  qr_code_data: string;
  creator_name?: string;
}

export default function GeradorQRCode() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<QRCodeRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('qr-codes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_codes' },
        () => loadHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading QR codes:', error);
      toast.error('Erro ao carregar histórico');
      setIsLoadingHistory(false);
      return;
    }

    // Fetch creator names
    const userIds = [...new Set(data.map(qr => qr.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    setHistory(data.map(qr => ({
      ...qr,
      creator_name: profileMap.get(qr.created_by) || 'Desconhecido'
    })));
    setIsLoadingHistory(false);
  };

  const generateQRCode = async () => {
    if (!url.trim()) {
      toast.error('Por favor, insira uma URL');
      return;
    }

    // Validate URL
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast.error('URL inválida');
      return;
    }

    setIsGenerating(true);

    try {
      const finalUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Generate QR code using canvas
      const qrData = await generateQRCodeCanvas(finalUrl);
      
      if (!qrData) {
        throw new Error('Falha ao gerar QR Code');
      }

      setGeneratedQR(qrData);

      // Save to database
      if (user) {
        const { error } = await supabase
          .from('qr_codes')
          .insert({
            url: finalUrl,
            title: title.trim() || null,
            created_by: user.id,
            qr_code_data: qrData
          });

        if (error) {
          console.error('Error saving QR code:', error);
          toast.error('Erro ao salvar QR Code no histórico');
        } else {
          toast.success('QR Code gerado e salvo com sucesso!');
          loadHistory();
        }
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erro ao gerar QR Code');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateQRCodeCanvas = async (text: string): Promise<string> => {
    try {
      const qrDataUrl = await QRCode.toDataURL(text, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  const downloadQRCode = (qrData: string, qrTitle?: string | null) => {
    const link = document.createElement('a');
    link.download = `qrcode-${qrTitle || 'download'}-${Date.now()}.png`;
    link.href = qrData;
    link.click();
    toast.success('QR Code baixado!');
  };

  const copyToClipboard = async (qrData: string) => {
    try {
      const response = await fetch(qrData);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast.success('QR Code copiado para a área de transferência!');
    } catch {
      toast.error('Não foi possível copiar o QR Code');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('qr_codes')
      .delete()
      .eq('id', deleteId);

    if (error) {
      console.error('Error deleting QR code:', error);
      toast.error('Erro ao excluir QR Code');
    } else {
      toast.success('QR Code excluído!');
      loadHistory();
    }
    setDeleteId(null);
  };

  const clearForm = () => {
    setUrl('');
    setTitle('');
    setGeneratedQR(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
            <QrCode className="h-8 w-8 text-purple-600" />
            Gerador de QR Code
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie QR Codes a partir de links e tenha acesso ao histórico de todos os códigos gerados
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-600" />
                Gerar Novo QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título (opcional)</Label>
                <Input
                  id="title"
                  placeholder="Ex: Site do Escritório"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    placeholder="https://exemplo.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={generateQRCode} 
                  disabled={isGenerating || !url.trim()}
                  className="flex-1"
                >
                  {isGenerating ? 'Gerando...' : 'Gerar QR Code'}
                </Button>
                {(url || title || generatedQR) && (
                  <Button variant="outline" onClick={clearForm}>
                    Limpar
                  </Button>
                )}
              </div>

              {/* Generated QR Code Display */}
              {generatedQR && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                  <div className="flex flex-col items-center gap-4">
                    <img 
                      src={generatedQR} 
                      alt="QR Code gerado" 
                      className="w-48 h-48 border rounded-lg bg-white p-2"
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadQRCode(generatedQR, title)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(generatedQR)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                Histórico de QR Codes
                <Badge variant="secondary" className="ml-2">
                  {history.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum QR Code gerado ainda</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {history.map((qr) => (
                    <div 
                      key={qr.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <img 
                        src={qr.qr_code_data} 
                        alt="QR Code" 
                        className="w-16 h-16 border rounded bg-white p-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        {qr.title && (
                          <p className="font-medium text-sm truncate">{qr.title}</p>
                        )}
                        <a 
                          href={qr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          {qr.url}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {qr.creator_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(qr.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => downloadQRCode(qr.qr_code_data, qr.title)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(qr.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir QR Code?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O QR Code será removido permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
