import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, RefreshCw, Webhook, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RDStationWebhook {
  uuid: string;
  event_type: string;
  url: string;
  http_method: string;
}

export function RDStationWebhookManager() {
  const [webhooks, setWebhooks] = useState<RDStationWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);

  const supabaseUrl = "https://igzcajgwqfpcgybxanjo.supabase.co";
  const expectedWebhookUrl = `${supabaseUrl}/functions/v1/rdstation-webhook`;

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rd-station-webhooks', {
        body: { action: 'list' }
      });

      if (error) throw error;
      
      // Ensure webhooks is always an array
      const webhooksData = Array.isArray(data.webhooks) ? data.webhooks : [];
      setWebhooks(webhooksData);
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      toast.error('Erro ao carregar webhooks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('rd-station-webhooks', {
        body: { action: 'create' }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Webhook criado com sucesso!');
        fetchWebhooks();
      } else {
        toast.error('Erro ao criar webhook: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error: any) {
      console.error('Error creating webhook:', error);
      toast.error('Erro ao criar webhook: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    setDeletingId(webhookId);
    try {
      const { data, error } = await supabase.functions.invoke('rd-station-webhooks', {
        body: { action: 'delete', webhookId }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Webhook excluído com sucesso!');
        fetchWebhooks();
      } else {
        toast.error('Erro ao excluir webhook: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error('Erro ao excluir webhook: ' + error.message);
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setWebhookToDelete(null);
    }
  };

  const handleDeleteClick = (webhookId: string) => {
    setWebhookToDelete(webhookId);
    setDeleteDialogOpen(true);
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const isOurWebhook = (webhook: RDStationWebhook) => 
    webhook.url === expectedWebhookUrl && webhook.event_type === 'crm_deal_updated';

  const hasOurWebhook = webhooks.some(isOurWebhook);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle>Webhooks RD Station</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWebhooks}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Configure webhooks para receber notificações automáticas quando contratos são fechados no RD Station CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          {hasOurWebhook ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Webhook configurado e ativo
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Webhook não configurado
              </span>
            </>
          )}
        </div>

        {/* Create button */}
        {!hasOurWebhook && (
          <Button onClick={createWebhook} disabled={creating} className="w-full">
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Criar Webhook de Fechamento de Contrato
          </Button>
        )}

        {/* Webhooks list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Webhooks Ativos:</h4>
            {webhooks.map((webhook) => (
              <div
                key={webhook.uuid}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isOurWebhook(webhook) ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={isOurWebhook(webhook) ? "default" : "secondary"}>
                      {webhook.event_type}
                    </Badge>
                    <Badge variant="outline">{webhook.http_method}</Badge>
                    {isOurWebhook(webhook) && (
                      <Badge className="bg-green-500">Intranet</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {webhook.url}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {webhook.uuid}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(webhook.uuid)}
                  disabled={deletingId === webhook.uuid}
                  className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {deletingId === webhook.uuid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum webhook encontrado
          </p>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <p className="font-medium mb-1">Como funciona:</p>
          <p>Quando um negócio é marcado como "ganho" no RD Station CRM, uma notificação será enviada automaticamente para os usuários administrativos e a Mariana Amorim receberá uma tarefa para delegação.</p>
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este webhook? Você não receberá mais notificações automáticas de fechamento de contrato até criar um novo webhook.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => webhookToDelete && deleteWebhook(webhookToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
