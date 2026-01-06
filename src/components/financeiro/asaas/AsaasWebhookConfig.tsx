import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Webhook, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Link2,
  Unlink,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WebhookEvent {
  id: string;
  event_type: string;
  payment_id: string | null;
  customer_id: string | null;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  event_data: unknown;
}

interface PaymentLink {
  id: string;
  asaas_payment_id: string;
  lancamento_id: string | null;
  asaas_customer_id: string;
  customer_name: string | null;
  value: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  billing_type: string;
  created_at: string;
  updated_at: string;
}

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

const EVENT_LABELS: Record<string, string> = {
  'PAYMENT_CREATED': 'Cobrança criada',
  'PAYMENT_AWAITING_RISK_ANALYSIS': 'Aguardando análise de risco',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS': 'Aprovado pela análise de risco',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS': 'Reprovado pela análise de risco',
  'PAYMENT_UPDATED': 'Cobrança atualizada',
  'PAYMENT_CONFIRMED': 'Cobrança confirmada',
  'PAYMENT_RECEIVED': 'Pagamento recebido',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED': 'Captura de cartão recusada',
  'PAYMENT_ANTICIPATED': 'Cobrança antecipada',
  'PAYMENT_OVERDUE': 'Cobrança vencida',
  'PAYMENT_DELETED': 'Cobrança excluída',
  'PAYMENT_RESTORED': 'Cobrança restaurada',
  'PAYMENT_REFUNDED': 'Cobrança estornada',
  'PAYMENT_REFUND_IN_PROGRESS': 'Estorno em processamento',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE': 'Recebimento desfeito',
  'PAYMENT_CHARGEBACK_REQUESTED': 'Chargeback solicitado',
  'PAYMENT_CHARGEBACK_DISPUTE': 'Disputa de chargeback',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL': 'Aguardando reversão de chargeback',
  'PAYMENT_DUNNING_RECEIVED': 'Recuperação recebida',
  'PAYMENT_DUNNING_REQUESTED': 'Recuperação solicitada',
  'PAYMENT_BANK_SLIP_VIEWED': 'Boleto visualizado',
  'PAYMENT_CHECKOUT_VIEWED': 'Checkout visualizado',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'PENDING': { label: 'Pendente', variant: 'secondary' },
  'RECEIVED': { label: 'Recebido', variant: 'default' },
  'CONFIRMED': { label: 'Confirmado', variant: 'default' },
  'OVERDUE': { label: 'Vencido', variant: 'destructive' },
  'REFUNDED': { label: 'Estornado', variant: 'outline' },
  'RECEIVED_IN_CASH': { label: 'Recebido em dinheiro', variant: 'default' },
  'REFUND_REQUESTED': { label: 'Estorno solicitado', variant: 'outline' },
  'REFUND_IN_PROGRESS': { label: 'Estorno em processamento', variant: 'outline' },
  'CHARGEBACK_REQUESTED': { label: 'Chargeback solicitado', variant: 'destructive' },
  'CHARGEBACK_DISPUTE': { label: 'Disputa de chargeback', variant: 'destructive' },
  'AWAITING_CHARGEBACK_REVERSAL': { label: 'Aguardando reversão', variant: 'outline' },
  'DUNNING_REQUESTED': { label: 'Em recuperação', variant: 'outline' },
  'DUNNING_RECEIVED': { label: 'Recuperado', variant: 'default' },
  'AWAITING_RISK_ANALYSIS': { label: 'Em análise de risco', variant: 'secondary' },
};

export function AsaasWebhookConfig() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedPaymentLink, setSelectedPaymentLink] = useState<PaymentLink | null>(null);
  const [selectedLancamentoId, setSelectedLancamentoId] = useState<string>('');

  const webhookUrl = `https://igzcajgwqfpcgybxanjo.supabase.co/functions/v1/asaas-webhook`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsResult, linksResult, lancamentosResult] = await Promise.all([
        supabase
          .from('asaas_webhook_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('asaas_payment_links')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(100),
        supabase
          .from('fin_lancamentos')
          .select('id, descricao, valor, data_vencimento, status')
          .eq('tipo', 'receita')
          .or('status.eq.pendente,status.eq.agendado')
          .order('data_vencimento', { ascending: true })
          .limit(200),
      ]);

      if (eventsResult.data) setEvents(eventsResult.data);
      if (linksResult.data) setPaymentLinks(linksResult.data as PaymentLink[]);
      if (lancamentosResult.data) setLancamentos(lancamentosResult.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada para a área de transferência');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const openLinkDialog = (paymentLink: PaymentLink) => {
    setSelectedPaymentLink(paymentLink);
    setSelectedLancamentoId(paymentLink.lancamento_id || '');
    setLinkDialogOpen(true);
  };

  const handleLinkLancamento = async () => {
    if (!selectedPaymentLink) return;

    try {
      const { error } = await supabase
        .from('asaas_payment_links')
        .update({ lancamento_id: selectedLancamentoId || null })
        .eq('id', selectedPaymentLink.id);

      if (error) throw error;

      toast.success(selectedLancamentoId ? 'Lançamento vinculado com sucesso' : 'Vínculo removido');
      setLinkDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao vincular:', error);
      toast.error('Erro ao vincular lançamento');
    }
  };

  return (
    <div className="space-y-6">
      {/* Instruções de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configuração do Webhook
          </CardTitle>
          <CardDescription>
            Configure o webhook no painel do Asaas para sincronizar automaticamente os pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Passo a passo para configurar:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-2">
                <li>Acesse o painel do Asaas → Configurações → Integrações → Webhooks</li>
                <li>Clique em "Adicionar Webhook"</li>
                <li>Cole a URL abaixo no campo "URL"</li>
                <li>Selecione os eventos que deseja receber (recomendamos todos os de "Cobranças")</li>
                <li>Clique em "Salvar"</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm break-all">{webhookUrl}</code>
            <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Eventos de Cobrança Recomendados</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ PAYMENT_CREATED - Cobrança criada</li>
                  <li>✓ PAYMENT_CONFIRMED - Cobrança confirmada</li>
                  <li>✓ PAYMENT_RECEIVED - Pagamento recebido</li>
                  <li>✓ PAYMENT_OVERDUE - Cobrança vencida</li>
                  <li>✓ PAYMENT_REFUNDED - Cobrança estornada</li>
                  <li>✓ PAYMENT_DELETED - Cobrança excluída</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">O que acontece automaticamente</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Registro de todos os eventos recebidos</li>
                  <li>✓ Baixa automática quando pagamento é confirmado</li>
                  <li>✓ Atualização de status dos lançamentos</li>
                  <li>✓ Vinculação automática por referência externa</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Eventos Recebidos</TabsTrigger>
          <TabsTrigger value="links">Vínculos de Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Eventos</CardTitle>
                <CardDescription>Últimos 50 eventos recebidos do Asaas</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum evento recebido ainda</p>
                  <p className="text-sm">Configure o webhook no Asaas para começar a receber eventos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>ID Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-sm">
                          {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {EVENT_LABELS[event.event_type] || event.event_type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.payment_id || '-'}
                        </TableCell>
                        <TableCell>
                          {event.processed ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Processado
                            </Badge>
                          ) : event.error_message ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Erro
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vínculos de Pagamento</CardTitle>
                <CardDescription>
                  Pagamentos do Asaas e seus vínculos com lançamentos do sistema
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {paymentLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum pagamento sincronizado ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Asaas</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-sm">
                          {link.asaas_payment_id}
                        </TableCell>
                        <TableCell>{formatCurrency(link.value || 0)}</TableCell>
                        <TableCell>
                          {link.due_date ? format(new Date(link.due_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_LABELS[link.status]?.variant || 'secondary'}>
                            {STATUS_LABELS[link.status]?.label || link.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {link.lancamento_id ? (
                            <Badge variant="outline" className="gap-1">
                              <Link2 className="h-3 w-3" />
                              Vinculado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Unlink className="h-3 w-3" />
                              Não vinculado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLinkDialog(link)}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para vincular lançamento */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Lançamento</DialogTitle>
            <DialogDescription>
              Selecione um lançamento para vincular a este pagamento do Asaas
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentLink && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p><strong>ID Asaas:</strong> {selectedPaymentLink.asaas_payment_id}</p>
                <p><strong>Valor:</strong> {formatCurrency(selectedPaymentLink.value || 0)}</p>
                <p><strong>Status:</strong> {STATUS_LABELS[selectedPaymentLink.status]?.label || selectedPaymentLink.status}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Lançamento</label>
                <Select value={selectedLancamentoId} onValueChange={setSelectedLancamentoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lançamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum (remover vínculo)</SelectItem>
                    {lancamentos.map((lanc) => (
                      <SelectItem key={lanc.id} value={lanc.id}>
                        {lanc.descricao} - {formatCurrency(lanc.valor)} (venc. {format(new Date(lanc.data_vencimento), 'dd/MM/yyyy')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkLancamento}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
