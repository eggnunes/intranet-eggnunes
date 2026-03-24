import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, FileSignature, CheckCircle2, Clock, XCircle, ExternalLink, Search, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ZapSignDocument {
  id: string;
  document_token: string;
  document_type: string;
  document_name: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  status: string;
  client_signer_status: string | null;
  marcos_signer_status: string | null;
  rafael_signer_status: string | null;
  witness1_name: string | null;
  witness1_signer_status: string | null;
  witness2_name: string | null;
  witness2_signer_status: string | null;
  sign_url: string | null;
  signed_file_url: string | null;
  original_file_url: string | null;
  created_at: string;
  signed_at: string | null;
  completed_at: string | null;
}

type StatusFilter = 'all' | 'pending' | 'signed' | 'refused';
type TypeFilter = 'all' | 'contrato' | 'procuracao';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  signed: { label: 'Assinado', variant: 'default', icon: CheckCircle2 },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  refused: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expirado', variant: 'destructive', icon: XCircle },
};

const getStatusBadge = (status: string | null) => {
  const config = statusConfig[status || 'pending'] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

export const CRMZapSignContracts = () => {
  const [documents, setDocuments] = useState<ZapSignDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');

  const fetchDocuments = async () => {
    try {
      let query = supabase
        .from('zapsign_documents')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setDocuments((data as ZapSignDocument[]) || []);
    } catch (error) {
      console.error('Erro ao buscar documentos ZapSign:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const channel = supabase
      .channel('zapsign-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapsign_documents' }, () => {
        fetchDocuments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    const pendingDocs = documents.filter(d => d.status === 'pending');
    let updated = 0;

    for (const doc of pendingDocs) {
      try {
        const { data, error } = await supabase.functions.invoke('zapsign-integration', {
          body: { action: 'check_status', documentToken: doc.document_token },
        });
        if (!error && data?.success) updated++;
      } catch (err) {
        console.error(`Erro ao atualizar status do doc ${doc.document_token}:`, err);
      }
    }

    toast.success(`${updated} documento(s) atualizado(s) de ${pendingDocs.length} pendente(s)`);
    await fetchDocuments();
    setRefreshing(false);
  };

  const filtered = documents.filter(doc => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (typeFilter !== 'all' && doc.document_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!doc.client_name.toLowerCase().includes(s) && !doc.document_name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const totals = {
    total: documents.length,
    signed: documents.filter(d => d.status === 'signed').length,
    pending: documents.filter(d => d.status === 'pending').length,
    other: documents.filter(d => !['signed', 'pending'].includes(d.status)).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Assinados</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{totals.signed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{totals.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Outros</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{totals.other}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou documento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="signed">Assinados</SelectItem>
            <SelectItem value="refused">Recusados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="contrato">Contratos</SelectItem>
            <SelectItem value="procuracao">Procurações</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleRefreshStatus} disabled={refreshing} variant="outline" className="gap-2">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar Status
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Contratos ZapSign ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum documento encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status Geral</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Marcos</TableHead>
                    <TableHead>Rafael</TableHead>
                    <TableHead>Testemunhas</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={doc.document_name}>
                        {doc.document_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.document_type === 'contrato' ? 'Contrato' : 'Procuração'}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.client_name}</TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell>{getStatusBadge(doc.client_signer_status)}</TableCell>
                      <TableCell>
                        {doc.document_type === 'contrato' ? getStatusBadge(doc.marcos_signer_status) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {doc.document_type === 'contrato' ? getStatusBadge(doc.rafael_signer_status) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {doc.witness1_name ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs">
                              <span>{doc.witness1_name}:</span>
                              {getStatusBadge(doc.witness1_signer_status)}
                            </div>
                            {doc.witness2_name && (
                              <div className="flex items-center gap-1 text-xs">
                                <span>{doc.witness2_name}:</span>
                                {getStatusBadge(doc.witness2_signer_status)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {doc.sign_url && doc.client_signer_status === 'pending' && (
                            <Button variant="ghost" size="icon" asChild title="Link de assinatura do cliente">
                              <a href={doc.sign_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {doc.signed_file_url && (
                            <Button variant="ghost" size="icon" asChild title="Documento assinado">
                              <a href={doc.signed_file_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4 text-green-600" />
                              </a>
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
      </Card>
    </div>
  );
};
