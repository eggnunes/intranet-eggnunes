import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Download, Eye, EyeOff, AlertCircle, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Publicacao {
  id: string;
  numero_processo: string;
  tribunal: string;
  tipo_comunicacao: string;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  conteudo: string;
  destinatario: string;
  meio: string;
  nome_advogado: string;
  numero_comunicacao: string;
  siglaTribunal: string;
  lida: boolean;
  raw_data?: any;
}

const TRIBUNAIS = [
  { value: '', label: 'Todos' },
  { value: 'TJSP', label: 'TJSP - São Paulo' },
  { value: 'TJRJ', label: 'TJRJ - Rio de Janeiro' },
  { value: 'TJMG', label: 'TJMG - Minas Gerais' },
  { value: 'TJRS', label: 'TJRS - Rio Grande do Sul' },
  { value: 'TJPR', label: 'TJPR - Paraná' },
  { value: 'TJSC', label: 'TJSC - Santa Catarina' },
  { value: 'TJBA', label: 'TJBA - Bahia' },
  { value: 'TJPE', label: 'TJPE - Pernambuco' },
  { value: 'TJCE', label: 'TJCE - Ceará' },
  { value: 'TJGO', label: 'TJGO - Goiás' },
  { value: 'TJDF', label: 'TJDF - Distrito Federal' },
  { value: 'TJES', label: 'TJES - Espírito Santo' },
  { value: 'TJMA', label: 'TJMA - Maranhão' },
  { value: 'TJPA', label: 'TJPA - Pará' },
  { value: 'TJMT', label: 'TJMT - Mato Grosso' },
  { value: 'TJMS', label: 'TJMS - Mato Grosso do Sul' },
  { value: 'TJPB', label: 'TJPB - Paraíba' },
  { value: 'TJRN', label: 'TJRN - Rio Grande do Norte' },
  { value: 'TJAL', label: 'TJAL - Alagoas' },
  { value: 'TJSE', label: 'TJSE - Sergipe' },
  { value: 'TJPI', label: 'TJPI - Piauí' },
  { value: 'TJTO', label: 'TJTO - Tocantins' },
  { value: 'TJAC', label: 'TJAC - Acre' },
  { value: 'TJAM', label: 'TJAM - Amazonas' },
  { value: 'TJRO', label: 'TJRO - Rondônia' },
  { value: 'TJRR', label: 'TJRR - Roraima' },
  { value: 'TJAP', label: 'TJAP - Amapá' },
  { value: 'TRF1', label: 'TRF1 - 1ª Região' },
  { value: 'TRF2', label: 'TRF2 - 2ª Região' },
  { value: 'TRF3', label: 'TRF3 - 3ª Região' },
  { value: 'TRF4', label: 'TRF4 - 4ª Região' },
  { value: 'TRF5', label: 'TRF5 - 5ª Região' },
  { value: 'TRF6', label: 'TRF6 - 6ª Região' },
  { value: 'TST', label: 'TST - Tribunal Superior do Trabalho' },
  { value: 'STJ', label: 'STJ - Superior Tribunal de Justiça' },
  { value: 'STF', label: 'STF - Supremo Tribunal Federal' },
];

const TIPOS_COMUNICACAO = [
  { value: '', label: 'Todos' },
  { value: 'CI', label: 'Citação' },
  { value: 'IN', label: 'Intimação' },
  { value: 'NT', label: 'Notificação' },
];

export default function PublicacoesDJE() {
  const [credentialsConfigured, setCredentialsConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [selectedPub, setSelectedPub] = useState<Publicacao | null>(null);
  const [searchSource, setSearchSource] = useState<'local' | 'api'>('local');

  // Filters
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [tribunal, setTribunal] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoComunicacao, setTipoComunicacao] = useState('');

  useEffect(() => {
    checkCredentials();
    handleSearch('local');
  }, []);

  const checkCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
        body: { action: 'check-credentials' },
      });
      if (!error && data) {
        setCredentialsConfigured(data.configured);
      }
    } catch {
      setCredentialsConfigured(false);
    }
  };

  const handleSearch = async (source?: string) => {
    const src = source || searchSource;
    setLoading(true);
    try {
      const filters: any = {};
      if (numeroProcesso) filters.numeroProcesso = numeroProcesso;
      if (tribunal) filters.tribunal = tribunal;
      if (dataInicio) filters.dataInicio = dataInicio;
      if (dataFim) filters.dataFim = dataFim;
      if (tipoComunicacao) filters.tipoComunicacao = tipoComunicacao;

      const { data, error } = await supabase.functions.invoke('pje-publicacoes', {
        body: { action: src === 'api' ? 'search-api' : 'search-local', filters },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (src === 'api') {
        toast.success(`${data.cached || 0} publicações encontradas e salvas no cache.`);
        // Reload from local after API search to get enriched data
        await handleSearch('local');
        return;
      }

      setPublicacoes(data?.data || []);
    } catch (err: any) {
      toast.error('Erro ao buscar publicações: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const toggleRead = async (pub: Publicacao) => {
    try {
      const action = pub.lida ? 'mark-unread' : 'mark-read';
      await supabase.functions.invoke('pje-publicacoes', {
        body: { action, publicacaoId: pub.id },
      });
      setPublicacoes(prev =>
        prev.map(p => p.id === pub.id ? { ...p, lida: !p.lida } : p)
      );
    } catch {
      toast.error('Erro ao atualizar status de leitura');
    }
  };

  const exportCSV = () => {
    if (publicacoes.length === 0) {
      toast.error('Nenhuma publicação para exportar');
      return;
    }
    const headers = ['Processo', 'Tribunal', 'Tipo', 'Data Disponibilização', 'Destinatário', 'Advogado', 'Conteúdo'];
    const rows = publicacoes.map(p => [
      p.numero_processo,
      p.tribunal || p.siglaTribunal,
      p.tipo_comunicacao,
      p.data_disponibilizacao ? format(new Date(p.data_disponibilizacao), 'dd/MM/yyyy') : '',
      p.destinatario,
      p.nome_advogado,
      (p.conteudo || '').replace(/"/g, '""').substring(0, 500),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publicacoes_dje_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const tipoBadgeColor = (tipo: string) => {
    switch (tipo?.toUpperCase()) {
      case 'CI': case 'CITAÇÃO': return 'destructive';
      case 'IN': case 'INTIMAÇÃO': return 'default';
      case 'NT': case 'NOTIFICAÇÃO': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Publicações DJE</h1>
            <p className="text-muted-foreground">Consulta de publicações do Diário da Justiça Eletrônica via API do CNJ</p>
          </div>
          <div className="flex items-center gap-2">
            {credentialsConfigured === true && (
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600 dark:text-emerald-400 dark:border-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> API Conectada
              </Badge>
            )}
            {credentialsConfigured === false && (
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400">
                <AlertCircle className="h-3 w-3" /> API Não Configurada
              </Badge>
            )}
          </div>
        </div>

        {credentialsConfigured === false && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Credenciais da API não configuradas</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Para consultar publicações diretamente da API do CNJ, é necessário configurar as credenciais 
                    (PJE_CNJ_USERNAME e PJE_CNJ_PASSWORD). Solicite acesso em{' '}
                    <a href="https://comunica.pje.jus.br" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      comunica.pje.jus.br
                    </a>.
                    Enquanto isso, você pode consultar publicações já salvas no cache local.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" /> Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Número do Processo</Label>
                <Input
                  placeholder="0000000-00.0000.0.00.0000"
                  value={numeroProcesso}
                  onChange={e => setNumeroProcesso(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tribunal</Label>
                <Select value={tribunal} onValueChange={setTribunal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tribunal" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIBUNAIS.map(t => (
                      <SelectItem key={t.value || 'all'} value={t.value || 'all'}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Comunicação</Label>
                <Select value={tipoComunicacao} onValueChange={setTipoComunicacao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_COMUNICACAO.map(t => (
                      <SelectItem key={t.value || 'all'} value={t.value || 'all'}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={() => handleSearch('local')} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Buscar no Cache
              </Button>
              {credentialsConfigured && (
                <Button variant="outline" onClick={() => { setSearchSource('api'); handleSearch('api'); }} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Buscar na API do CNJ
                </Button>
              )}
              <Button variant="outline" onClick={exportCSV} disabled={publicacoes.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultados
              {publicacoes.length > 0 && (
                <Badge variant="secondary">{publicacoes.length} publicações</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : publicacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma publicação encontrada</p>
                <p className="text-sm mt-1">Ajuste os filtros ou consulte a API do CNJ para novas publicações</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Tribunal</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publicacoes.map(pub => (
                      <TableRow
                        key={pub.id}
                        className={`cursor-pointer ${pub.lida ? 'opacity-60' : ''}`}
                        onClick={() => setSelectedPub(pub)}
                      >
                        <TableCell>
                          {pub.lida ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Badge variant="default" className="text-xs">Nova</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(pub.data_disponibilizacao)}</TableCell>
                        <TableCell className="font-mono text-xs">{pub.numero_processo}</TableCell>
                        <TableCell>{pub.siglaTribunal || pub.tribunal}</TableCell>
                        <TableCell>
                          <Badge variant={tipoBadgeColor(pub.tipo_comunicacao) as any}>
                            {pub.tipo_comunicacao || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{pub.destinatario || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); toggleRead(pub); }}
                            title={pub.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                          >
                            {pub.lida ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Publicação</DialogTitle>
            </DialogHeader>
            {selectedPub && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Processo</Label>
                    <p className="font-mono">{selectedPub.numero_processo}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tribunal</Label>
                    <p>{selectedPub.tribunal || selectedPub.siglaTribunal}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <Badge variant={tipoBadgeColor(selectedPub.tipo_comunicacao) as any}>
                      {selectedPub.tipo_comunicacao}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data Disponibilização</Label>
                    <p>{formatDate(selectedPub.data_disponibilizacao)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Destinatário</Label>
                    <p>{selectedPub.destinatario || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Advogado</Label>
                    <p>{selectedPub.nome_advogado || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Nº Comunicação</Label>
                    <p>{selectedPub.numero_comunicacao || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Meio</Label>
                    <p>{selectedPub.meio || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Conteúdo</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {selectedPub.conteudo || 'Conteúdo não disponível'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleRead(selectedPub)}>
                    {selectedPub.lida ? (
                      <><EyeOff className="h-4 w-4 mr-2" /> Marcar como não lida</>
                    ) : (
                      <><Eye className="h-4 w-4 mr-2" /> Marcar como lida</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
