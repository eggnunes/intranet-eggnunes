import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileSignature, 
  Loader2, 
  Send, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Camera,
  CreditCard,
  Mail,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ZapSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'contrato' | 'procuracao';
  documentName: string;
  pdfBase64: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  onSuccess?: (signUrl: string) => void;
}

interface ZapSignResult {
  success: boolean;
  documentToken: string;
  signUrl: string;
  signers: Array<{
    name: string;
    email: string;
    signUrl: string;
    status: string;
  }>;
}

export const ZapSignDialog = ({
  open,
  onOpenChange,
  documentType,
  documentName,
  pdfBase64,
  clientName,
  clientEmail,
  clientPhone,
  clientCpf,
  onSuccess,
}: ZapSignDialogProps) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ZapSignResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Opções de autenticação
  const [requireSelfie, setRequireSelfie] = useState(true);
  const [requireDocumentPhoto, setRequireDocumentPhoto] = useState(true);
  const [sendViaWhatsapp, setSendViaWhatsapp] = useState(false);
  const [sendViaEmail, setSendViaEmail] = useState(false);

  // Dados do cliente editáveis
  const [editableEmail, setEditableEmail] = useState(clientEmail || "");
  const [editablePhone, setEditablePhone] = useState(clientPhone || "");

  const handleSendToZapSign = async () => {
    setSending(true);
    setError(null);
    setResult(null);

    try {
      console.log('Enviando documento para ZapSign...');
      
      const { data, error: invokeError } = await supabase.functions.invoke('zapsign-integration', {
        body: {
          documentType,
          documentName,
          pdfBase64,
          clientName,
          clientEmail: editableEmail || clientEmail,
          clientPhone: editablePhone || clientPhone,
          clientCpf,
          requireSelfie,
          requireDocumentPhoto,
          sendViaWhatsapp,
          sendViaEmail,
        },
      });

      if (invokeError) {
        console.error('Erro ao invocar função:', invokeError);
        throw new Error(invokeError.message || 'Erro ao enviar para ZapSign');
      }

      if (data?.error) {
        console.error('Erro retornado pela API:', data);
        throw new Error(data.details || data.error);
      }

      console.log('Resposta do ZapSign:', data);
      setResult(data);
      
      toast.success('Documento enviado para assinatura!', {
        description: 'O link de assinatura foi gerado com sucesso.',
      });

      if (onSuccess && data.signUrl) {
        onSuccess(data.signUrl);
      }

    } catch (err) {
      console.error('Erro ao enviar para ZapSign:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao enviar documento', {
        description: errorMessage,
      });
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  const documentTypeLabel = documentType === 'contrato' ? 'Contrato' : 'Procuração';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Enviar para Assinatura Digital
          </DialogTitle>
          <DialogDescription>
            Envie {documentTypeLabel.toLowerCase()} para assinatura eletrônica via ZapSign
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            {/* Informações do documento */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Documento:</span>
                  <Badge variant="secondary">{documentTypeLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-sm">{clientName}</span>
                </div>
                {clientCpf && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPF:</span>
                    <span className="text-sm">{clientCpf}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dados de contato editáveis */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Dados para envio do link</h4>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="zapsign-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail do cliente
                  </Label>
                  <Input
                    id="zapsign-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zapsign-phone" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp do cliente
                  </Label>
                  <Input
                    id="zapsign-phone"
                    type="tel"
                    placeholder="(31) 99999-9999"
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Opções de autenticação */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Autenticação do signatário</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="require-selfie" className="cursor-pointer">
                      Exigir selfie
                    </Label>
                  </div>
                  <Switch
                    id="require-selfie"
                    checked={requireSelfie}
                    onCheckedChange={setRequireSelfie}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="require-document" className="cursor-pointer">
                      Exigir foto do documento
                    </Label>
                  </div>
                  <Switch
                    id="require-document"
                    checked={requireDocumentPhoto}
                    onCheckedChange={setRequireDocumentPhoto}
                  />
                </div>
              </div>
            </div>

            {/* Opções de envio automático */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Envio automático (opcional)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="send-email" className="cursor-pointer">
                      Enviar por e-mail
                    </Label>
                  </div>
                  <Switch
                    id="send-email"
                    checked={sendViaEmail}
                    onCheckedChange={setSendViaEmail}
                    disabled={!editableEmail}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="send-whatsapp" className="cursor-pointer">
                      Enviar por WhatsApp
                    </Label>
                  </div>
                  <Switch
                    id="send-whatsapp"
                    checked={sendViaWhatsapp}
                    onCheckedChange={setSendViaWhatsapp}
                    disabled={!editablePhone}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se não enviar automaticamente, você receberá o link para compartilhar manualmente.
              </p>
            </div>

            {error && (
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">Erro ao enviar</p>
                      <p className="text-xs text-destructive/80">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Sucesso */}
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">Documento enviado com sucesso!</h3>
              <p className="text-sm text-muted-foreground">
                O link de assinatura foi gerado. Compartilhe com o cliente para que ele assine.
              </p>
            </div>

            {/* Link de assinatura */}
            {result.signUrl && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Label className="text-sm font-medium">Link de assinatura</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={result.signUrl} 
                      readOnly 
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(result.signUrl)}
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(result.signUrl, '_blank')}
                      title="Abrir link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const whatsappUrl = `https://wa.me/${editablePhone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${clientName}! Segue o link para assinatura do seu ${documentTypeLabel.toLowerCase()}: ${result.signUrl}`)}`;
                        window.open(whatsappUrl, '_blank');
                      }}
                      disabled={!editablePhone}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Enviar via WhatsApp
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const subject = encodeURIComponent(`${documentTypeLabel} para Assinatura - Egg Nunes Advocacia`);
                        const body = encodeURIComponent(`Olá ${clientName},\n\nSegue o link para assinatura do seu ${documentTypeLabel.toLowerCase()}:\n\n${result.signUrl}\n\nAtenciosamente,\nEgg Nunes Advocacia`);
                        window.open(`mailto:${editableEmail}?subject=${subject}&body=${body}`, '_blank');
                      }}
                      disabled={!editableEmail}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar via E-mail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informações do signatário */}
            {result.signers && result.signers.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Signatário</Label>
                    <div className="flex items-center justify-between text-sm">
                      <span>{result.signers[0].name}</span>
                      <Badge variant="outline">{result.signers[0].status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSendToZapSign} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar para ZapSign
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
