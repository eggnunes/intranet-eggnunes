import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Transfer {
  id: string;
  asaas_transfer_id: string;
  value: number;
  net_value: number | null;
  transfer_fee: number | null;
  status: string;
  transfer_type: string | null;
  description: string | null;
  scheduled_date: string | null;
  effective_date: string | null;
  transaction_receipt_url: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface InternalTransfer {
  id: string;
  asaas_transfer_id: string;
  transfer_type: string;
  value: number;
  status: string | null;
  description: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  BANK_PROCESSING: { label: 'Processando', variant: 'outline' },
  DONE: { label: 'Realizada', variant: 'default' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
  BLOCKED: { label: 'Bloqueada', variant: 'destructive' },
};

export function AsaasTransfers() {
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [internalTransfers, setInternalTransfers] = useState<InternalTransfer[]>([]);
  const [activeTab, setActiveTab] = useState('external');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transfersRes, internalRes] = await Promise.all([
        supabase
          .from('asaas_transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('asaas_internal_transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      if (transfersRes.error) throw transfersRes.error;
      if (internalRes.error) throw internalRes.error;

      setTransfers(transfersRes.data || []);
      setInternalTransfers(internalRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar transferências:', error);
      toast.error('Erro ao carregar transferências');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferências
            </CardTitle>
            <CardDescription>
              Transferências bancárias e movimentações internas
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="external">
              Transferências Bancárias ({transfers.length})
            </TabsTrigger>
            <TabsTrigger value="internal">
              Movimentações Internas ({internalTransfers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="external">
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transferência bancária encontrada</p>
                <p className="text-sm">As transferências aparecerão aqui quando forem processadas pelo webhook</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Efetiva</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(transfer => {
                      const statusInfo = STATUS_LABELS[transfer.status] || { label: transfer.status, variant: 'outline' as const };
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-mono text-sm">
                            {transfer.asaas_transfer_id}
                          </TableCell>
                          <TableCell>{formatCurrency(transfer.value)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {transfer.transfer_fee ? formatCurrency(transfer.transfer_fee) : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {transfer.net_value ? formatCurrency(transfer.net_value) : formatCurrency(transfer.value)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(transfer.effective_date)}</TableCell>
                          <TableCell>
                            {transfer.transaction_receipt_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(transfer.transaction_receipt_url!, '_blank')}
                                title="Ver comprovante"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {transfer.failure_reason && (
                              <span className="text-xs text-destructive" title={transfer.failure_reason}>
                                ⚠️
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="internal">
            {internalTransfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma movimentação interna encontrada</p>
                <p className="text-sm">As movimentações internas aparecerão aqui quando forem processadas pelo webhook</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalTransfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transfer.transfer_type === 'credit' ? (
                              <>
                                <ArrowDownLeft className="h-4 w-4 text-green-500" />
                                <Badge variant="default" className="bg-green-500">Crédito</Badge>
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                                <Badge variant="destructive">Débito</Badge>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {transfer.asaas_transfer_id}
                        </TableCell>
                        <TableCell className={transfer.transfer_type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                          {transfer.transfer_type === 'credit' ? '+' : '-'}{formatCurrency(transfer.value)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {transfer.description || '-'}
                        </TableCell>
                        <TableCell>{formatDate(transfer.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
