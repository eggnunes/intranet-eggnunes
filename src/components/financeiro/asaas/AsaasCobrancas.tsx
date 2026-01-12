import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Copy, 
  FileText, 
  CreditCard,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  QrCode
} from 'lucide-react';

interface Payment {
  id: string;
  customer: string;
  customerName?: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  installment?: string;
  installmentNumber?: number;
}

interface AsaasCobrancasProps {
  onNovaCobranca: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  RECEIVED: { label: 'Recebida', variant: 'default' },
  CONFIRMED: { label: 'Confirmada', variant: 'default' },
  OVERDUE: { label: 'Vencida', variant: 'destructive' },
  REFUNDED: { label: 'Estornada', variant: 'outline' },
  RECEIVED_IN_CASH: { label: 'Recebida em Dinheiro', variant: 'default' },
  REFUND_REQUESTED: { label: 'Estorno Solicitado', variant: 'outline' },
  CHARGEBACK_REQUESTED: { label: 'Chargeback', variant: 'destructive' },
  CHARGEBACK_DISPUTE: { label: 'Disputa', variant: 'destructive' },
  AWAITING_CHARGEBACK_REVERSAL: { label: 'Aguardando Reversão', variant: 'outline' },
  DUNNING_REQUESTED: { label: 'Negativação', variant: 'destructive' },
  DUNNING_RECEIVED: { label: 'Recuperado', variant: 'default' },
  AWAITING_RISK_ANALYSIS: { label: 'Análise de Risco', variant: 'outline' },
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  PIX: 'PIX',
  UNDEFINED: 'Indefinido',
};

export function AsaasCobrancas({ onNovaCobranca }: AsaasCobrancasProps) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [boletoInfo, setBoletoInfo] = useState<{ identificationField?: string; barCode?: string } | null>(null);
  const [pixInfo, setPixInfo] = useState<{ payload?: string; encodedImage?: string } | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const filters: Record<string, any> = { limit: 100 };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (billingTypeFilter !== 'all') filters.billingType = billingTypeFilter;

      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { action: 'list_payments', data: filters }
      });

      if (error) throw error;
      setPayments(data.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar cobranças:', error);
      toast.error('Erro ao carregar cobranças');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, billingTypeFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const openDetails = async (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailsOpen(true);
    setBoletoInfo(null);
    setPixInfo(null);

    // Buscar informações adicionais baseado no tipo
    if (payment.billingType === 'BOLETO' && payment.status === 'PENDING') {
      try {
        const { data } = await supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_payment_boleto', data: { paymentId: payment.id } }
        });
        setBoletoInfo(data);
      } catch (error) {
        console.error('Erro ao buscar linha digitável:', error);
      }
    }

    if (payment.billingType === 'PIX' && payment.status === 'PENDING') {
      try {
        const { data } = await supabase.functions.invoke('asaas-integration', {
          body: { action: 'get_payment_pix', data: { paymentId: payment.id } }
        });
        setPixInfo(data);
      } catch (error) {
        console.error('Erro ao buscar QR Code PIX:', error);
      }
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta cobrança?')) return;

    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { action: 'delete_payment', data: { paymentId } }
      });

      if (error) throw error;
      toast.success('Cobrança excluída com sucesso');
      fetchPayments();
    } catch (error: any) {
      toast.error('Erro ao excluir cobrança: ' + error.message);
    }
  };

  const filteredPayments = payments.filter(p => 
    !search || 
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Cobranças</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="RECEIVED">Recebida</SelectItem>
                <SelectItem value="OVERDUE">Vencida</SelectItem>
                <SelectItem value="CONFIRMED">Confirmada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={billingTypeFilter} onValueChange={setBillingTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchPayments}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma cobrança encontrada</p>
            <Button variant="outline" className="mt-4" onClick={onNovaCobranca}>
              Criar primeira cobrança
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.customerName || payment.customer}</p>
                        <p className="text-sm text-muted-foreground">{payment.description || 'Sem descrição'}</p>
                        {payment.installmentNumber && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Parcela {payment.installmentNumber}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {BILLING_TYPE_LABELS[payment.billingType] || payment.billingType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.value)}
                    </TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[payment.status]?.variant || 'outline'}>
                        {STATUS_LABELS[payment.status]?.label || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetails(payment)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {payment.invoiceUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {payment.status === 'PENDING' && (
                          <Button variant="ghost" size="icon" onClick={() => deletePayment(payment.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Cobrança</DialogTitle>
            <DialogDescription>
              {selectedPayment?.id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-bold text-lg">{formatCurrency(selectedPayment.value)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Líquido</p>
                  <p className="font-medium">{formatCurrency(selectedPayment.netValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{formatDate(selectedPayment.dueDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={STATUS_LABELS[selectedPayment.status]?.variant || 'outline'}>
                    {STATUS_LABELS[selectedPayment.status]?.label || selectedPayment.status}
                  </Badge>
                </div>
              </div>

              {selectedPayment.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p>{selectedPayment.description}</p>
                </div>
              )}

              {/* Linha Digitável do Boleto */}
              {boletoInfo?.identificationField && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Linha Digitável</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded break-all">
                      {boletoInfo.identificationField}
                    </code>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(boletoInfo.identificationField!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* QR Code PIX */}
              {pixInfo?.encodedImage && (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm font-medium mb-2">QR Code PIX</p>
                  <img 
                    src={`data:image/png;base64,${pixInfo.encodedImage}`} 
                    alt="QR Code PIX"
                    className="mx-auto w-48 h-48"
                  />
                  {pixInfo.payload && (
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => copyToClipboard(pixInfo.payload!)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código PIX
                    </Button>
                  )}
                </div>
              )}

              {/* Links */}
              <div className="flex gap-2">
                {selectedPayment.invoiceUrl && (
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={selectedPayment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Fatura
                    </a>
                  </Button>
                )}
                {selectedPayment.bankSlipUrl && (
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={selectedPayment.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-2" />
                      Boleto PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
