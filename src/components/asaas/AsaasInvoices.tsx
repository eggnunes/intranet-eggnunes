import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, FileText, Download, ExternalLink, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  asaas_invoice_id: string;
  customer_id: string;
  customer_name: string | null;
  value: number;
  status: string;
  service_description: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  authorized_date: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  SCHEDULED: { label: 'Agendada', variant: 'secondary' },
  PENDING: { label: 'Pendente', variant: 'outline' },
  AUTHORIZED: { label: 'Autorizada', variant: 'default' },
  PROCESSING_CANCELLATION: { label: 'Cancelando', variant: 'destructive' },
  CANCELED: { label: 'Cancelada', variant: 'destructive' },
  CANCELLATION_DENIED: { label: 'Canc. Negado', variant: 'destructive' },
  ERROR: { label: 'Erro', variant: 'destructive' },
};

export function AsaasInvoices() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('asaas_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Erro ao buscar notas fiscais:', error);
      toast.error('Erro ao carregar notas fiscais');
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

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.asaas_invoice_id?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.service_description?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
              <FileText className="h-5 w-5" />
              Notas Fiscais
            </CardTitle>
            <CardDescription>
              Notas fiscais recebidas via webhook do Asaas
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInvoices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma nota fiscal encontrada</p>
            <p className="text-sm">As notas fiscais aparecerão aqui quando forem processadas pelo webhook</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Autorização</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(invoice => {
                  const statusInfo = STATUS_LABELS[invoice.status] || { label: invoice.status, variant: 'outline' as const };
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_number || invoice.asaas_invoice_id}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.service_description || '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.value)}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.authorized_date)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {invoice.invoice_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(invoice.invoice_url!, '_blank')}
                              title="Ver nota fiscal"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.pdf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(invoice.pdf_url!, '_blank')}
                              title="Baixar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
