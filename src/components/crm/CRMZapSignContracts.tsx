import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Loader2, RefreshCw, FileSignature, CheckCircle2, Clock, XCircle, ExternalLink, Search, FileText, CloudUpload, Download, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeamsUpload } from '@/hooks/useTeamsUpload';

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

const ITEMS_PER_PAGE = 20;

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
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const { sites, drives, loadSites, loadDrives, findOrCreateClientFolder, uploadFile } = useTeamsUpload();

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('zapsign_documents')
        .select('*')
        .order('created_at', { ascending: false });
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

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapsign-integration', {
        body: { action: 'sync_all' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.totalSynced} documento(s) sincronizado(s) de ${data.totalFetched} encontrado(s)`);
        await fetchDocuments();
      } else {
        toast.error('Erro ao sincronizar documentos');
      }
    } catch (err) {
      console.error('Erro sync_all:', err);
      toast.error('Erro ao sincronizar com ZapSign');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveToTeams = async (doc: ZapSignDocument) => {
    const fileUrl = doc.signed_file_url || doc.original_file_url;
    if (!fileUrl) {
      toast.error('Nenhum arquivo disponível para salvar');
      return;
    }

    setSavingDocId(doc.id);
    try {
      // Load sites if needed
      let sitesList = sites;
      if (sitesList.length === 0) {
        sitesList = await loadSites();
      }

      const juridico = sitesList.find((s: any) => s.displayName?.toLowerCase().includes('jurídico') || s.displayName?.toLowerCase().includes('juridico'));
      if (!juridico) {
        toast.error('Site "Jurídico" não encontrado no Teams');
        return;
      }

      let drivesList = drives;
      if (drivesList.length === 0 || drives[0]) {
        drivesList = await loadDrives(juridico.id);
      }

      const docsDrive = drivesList.find((d: any) => d.name === 'Documentos' || d.name === 'Documents') || drivesList[0];
      if (!docsDrive) {
        toast.error('Drive não encontrado');
        return;
      }

      // Find or create client folder
      const clientFolder = await findOrCreateClientFolder(docsDrive.id, doc.client_name);
      if (!clientFolder.success || !clientFolder.folderId) {
        toast.error(clientFolder.error || 'Erro ao criar pasta do cliente');
        return;
      }

      // Fetch the PDF file
      toast.info('Baixando documento...');
      const pdfResp = await fetch(fileUrl);
      if (!pdfResp.ok) throw new Error('Erro ao baixar o arquivo');
      const pdfBlob = await pdfResp.arrayBuffer();
      const uint8 = new Uint8Array(pdfBlob);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      // Upload
      const fileName = `${doc.document_name}.pdf`;
      toast.info('Enviando para o Teams...');
      const result = await uploadFile(docsDrive.id, fileName, base64, clientFolder.folderId);

      if (result.success) {
        toast.success(`Documento salvo na pasta de ${doc.client_name} no Teams!`);
      } else {
        toast.error(result.error || 'Erro ao salvar no Teams');
      }
    } catch (err: any) {
      console.error('Erro ao salvar no Teams:', err);
      toast.error(err.message || 'Erro ao salvar no Teams');
    } finally {
      setSavingDocId(null);
    }
  };

  const handleSendReminder = async (doc: ZapSignDocument) => {
    if (!doc.client_phone) {
      toast.error('Telefone do cliente não cadastrado');
      return;
    }

    setSendingReminderId(doc.id);
    try {
      // Buscar template
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('content')
        .eq('shortcut', '/lembrete-assinatura')
        .maybeSingle();

      if (!template) {
        toast.error('Template de lembrete não encontrado');
        return;
      }

      const firstName = doc.client_name.split(' ')[0];
      const tipoDoc = doc.document_type === 'contrato' ? 'contrato' : 
                       doc.document_type === 'procuracao' ? 'procuração' : 'documento';

      const linkAssinatura = doc.sign_url || 'O link foi enviado anteriormente por e-mail.';

      const message = template.content
        .replace(/{nome}/g, firstName)
        .replace(/{tipo_documento}/g, tipoDoc)
        .replace(/{link_assinatura}/g, linkAssinatura);

      const { error } = await supabase.functions.invoke('zapi-send-message', {
        body: { action: 'send-message', phone: doc.client_phone, message, skipFooter: true },
      });

      if (error) throw error;
      toast.success(`Lembrete enviado para ${firstName}!`);
    } catch (err: any) {
      console.error('Erro ao enviar lembrete:', err);
      toast.error('Erro ao enviar lembrete: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSendingReminderId(null);
    }
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

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedDocs = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, typeFilter, search]);

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
        <Button onClick={handleSyncAll} disabled={syncing} variant="outline" className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Sincronizar ZapSign
        </Button>
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
            <>
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
                    {paginatedDocs.map(doc => (
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
                            {doc.client_signer_status === 'pending' && doc.client_phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Enviar lembrete de assinatura via WhatsApp"
                                disabled={sendingReminderId === doc.id}
                                onClick={() => handleSendReminder(doc)}
                              >
                                {sendingReminderId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MessageCircle className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}
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
                            {(doc.signed_file_url || doc.original_file_url) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Salvar na pasta do cliente no Teams"
                                disabled={savingDocId === doc.id}
                                onClick={() => handleSaveToTeams(doc)}
                              >
                                {savingDocId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CloudUpload className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => (
                          <PaginationItem key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-2 text-muted-foreground">…</span>
                            )}
                            <PaginationLink
                              isActive={p === currentPage}
                              onClick={() => setCurrentPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
