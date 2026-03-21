import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function WhatsAppWebhookInfo() {
  const [whatsappLeadCount, setWhatsappLeadCount] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('captured_leads')
        .select('*', { count: 'exact', head: true })
        .eq('utm_source', 'whatsapp');
      setWhatsappLeadCount(count || 0);
    };
    fetchCount();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-600" />
          Webhook WhatsApp Business
          <Badge variant="secondary" className="ml-auto">
            {whatsappLeadCount} leads via WhatsApp
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure o webhook abaixo na sua conta Meta Business para capturar leads
          automaticamente via WhatsApp, incluindo anúncios <strong>click-to-WhatsApp</strong>.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">URL do Webhook</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md break-all">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(webhookUrl, 'URL')}
              >
                {copied === 'URL' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Verify Token</label>
            <p className="text-xs text-muted-foreground mt-1">
              Use o mesmo valor que você configurou no secret <code>WHATSAPP_VERIFY_TOKEN</code>.
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Instruções de configuração:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Acesse o <strong>Meta Business Suite → WhatsApp → Configuração da API</strong></li>
            <li>Em "Webhook", cole a URL acima e o Verify Token</li>
            <li>Inscreva-se no campo <strong>messages</strong></li>
            <li>Leads de anúncios click-to-WhatsApp serão capturados com dados de referral</li>
          </ol>
        </div>

        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Documentação oficial do WhatsApp Cloud API
        </a>
      </CardContent>
    </Card>
  );
}
