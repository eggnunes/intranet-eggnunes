import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, CalendarIcon, ChevronLeft, ChevronRight, Eye, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface AuditLog {
  id: string;
  tabela: string;
  registro_id: string | null;
  acao: string;
  descricao: string | null;
  dados_anteriores: any;
  dados_novos: any;
  usuario_id: string | null;
  usuario_nome: string | null;
  created_at: string;
}

const TABELA_LABELS: Record<string, string> = {
  'fin_lancamentos': 'Lançamentos Financeiros',
  'fin_contratos': 'Contratos',
  'rh_pagamentos': 'Pagamentos RH',
  'announcements': 'Avisos',
  'suggestions': 'Sugestões',
  'administrative_requests': 'Solicitações Administrativas',
  'crm_deals': 'Negócios CRM',
  'crm_contacts': 'Contatos CRM',
  'vacation_requests': 'Solicitações de Férias',
  'event_gallery': 'Galeria de Eventos',
  'forum_topics': 'Tópicos do Fórum',
};

const ACAO_CONFIG: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  'criar': { label: 'Criado', color: 'bg-green-500', icon: Plus },
  'editar': { label: 'Editado', color: 'bg-blue-500', icon: Pencil },
  'excluir': { label: 'Excluído', color: 'bg-red-500', icon: Trash2 },
};

export function AuditLogHistory() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroTabela, setFiltroTabela] = useState<string>('all');
  const [filtroAcao, setFiltroAcao] = useState<string>('all');
  const [filtroUsuario, setFiltroUsuario] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
  const [usuarios, setUsuarios] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const pageSize = 50;

  const fetchUsuarios = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('approval_status', 'approved')
      .order('full_name');
    setUsuarios(data || []);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' });

    if (filtroTabela !== 'all') {
      query = query.eq('tabela', filtroTabela);
    }

    if (filtroAcao !== 'all') {
      query = query.eq('acao', filtroAcao);
    }

    if (filtroUsuario !== 'all') {
      query = query.eq('usuario_id', filtroUsuario);
    }

    if (dataInicio) {
      query = query.gte('created_at', startOfDay(dataInicio).toISOString());
    }

    if (dataFim) {
      query = query.lte('created_at', endOfDay(dataFim).toISOString());
    }

    if (searchQuery) {
      query = query.or(`usuario_nome.ilike.%${searchQuery}%,descricao.ilike.%${searchQuery}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Erro ao buscar logs:', error);
    } else {
      setLogs(data || []);
      setTotalCount(count || 0);
    }
    
    setLoading(false);
  }, [filtroTabela, filtroAcao, filtroUsuario, dataInicio, dataFim, searchQuery, page]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportExcel = () => {
    const exportData = logs.map(log => ({
      'Data/Hora': format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      'Usuário': log.usuario_nome || 'Sistema',
      'Ação': ACAO_CONFIG[log.acao]?.label || log.acao,
      'Módulo': TABELA_LABELS[log.tabela] || log.tabela,
      'Descrição': log.descricao || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, `historico_lancamentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const renderJsonDiff = (anterior: any, novo: any) => {
    if (!anterior && !novo) return <span className="text-muted-foreground">Sem dados</span>;
    
    const keys = new Set([
      ...Object.keys(anterior || {}),
      ...Object.keys(novo || {})
    ]);

    const ignoredKeys = ['id', 'created_at', 'updated_at', 'created_by', 'user_id'];

    return (
      <div className="space-y-2 text-sm">
        {Array.from(keys)
          .filter(key => !ignoredKeys.includes(key))
          .map(key => {
            const valorAnterior = anterior?.[key];
            const valorNovo = novo?.[key];
            const mudou = JSON.stringify(valorAnterior) !== JSON.stringify(valorNovo);
            
            if (!mudou && anterior) return null;
            
            return (
              <div key={key} className={`p-2 rounded ${mudou ? 'bg-muted' : ''}`}>
                <span className="font-medium text-muted-foreground">{key}:</span>
                {anterior && valorAnterior !== undefined && (
                  <div className="text-red-500 line-through text-xs">
                    {typeof valorAnterior === 'object' ? JSON.stringify(valorAnterior) : String(valorAnterior)}
                  </div>
                )}
                {valorNovo !== undefined && (
                  <div className="text-green-500 text-xs">
                    {typeof valorNovo === 'object' ? JSON.stringify(valorNovo) : String(valorNovo)}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Histórico de Lançamentos
            </CardTitle>
            <CardDescription>
              Registro de todas as atividades realizadas no sistema
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filtroTabela} onValueChange={setFiltroTabela}>
            <SelectTrigger>
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {Object.entries(TABELA_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger>
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="criar">Criação</SelectItem>
              <SelectItem value="editar">Edição</SelectItem>
              <SelectItem value="excluir">Exclusão</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
            <SelectTrigger>
              <SelectValue placeholder="Colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {usuarios.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {dataInicio ? format(dataInicio, 'dd/MM', { locale: ptBR }) : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {dataFim ? format(dataFim, 'dd/MM', { locale: ptBR }) : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Resumo */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCount} registros encontrados</span>
          <span>Página {page} de {totalPages || 1}</span>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum registro encontrado com os filtros selecionados
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Data/Hora</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="w-[100px]">Ação</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[80px]">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const acaoConfig = ACAO_CONFIG[log.acao] || { label: log.acao, color: 'bg-gray-500', icon: Eye };
                  const Icon = acaoConfig.icon;
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.usuario_nome || 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${acaoConfig.color} text-white`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {acaoConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {TABELA_LABELS[log.tabela] || log.tabela}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                        {log.descricao || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Modal de Detalhes */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Detalhes do Registro</DialogTitle>
              <DialogDescription>
                Informações completas sobre a alteração
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Data/Hora</span>
                      <p className="font-medium">
                        {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Colaborador</span>
                      <p className="font-medium">{selectedLog.usuario_nome || 'Sistema'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Ação</span>
                      <p>
                        <Badge className={`${ACAO_CONFIG[selectedLog.acao]?.color || 'bg-gray-500'} text-white`}>
                          {ACAO_CONFIG[selectedLog.acao]?.label || selectedLog.acao}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Módulo</span>
                      <p className="font-medium">{TABELA_LABELS[selectedLog.tabela] || selectedLog.tabela}</p>
                    </div>
                  </div>

                  {selectedLog.descricao && (
                    <div>
                      <span className="text-sm text-muted-foreground">Descrição</span>
                      <p>{selectedLog.descricao}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">Alterações</span>
                    <div className="bg-muted p-3 rounded-lg">
                      {renderJsonDiff(selectedLog.dados_anteriores, selectedLog.dados_novos)}
                    </div>
                  </div>

                  {selectedLog.registro_id && (
                    <div>
                      <span className="text-sm text-muted-foreground">ID do Registro</span>
                      <p className="font-mono text-xs">{selectedLog.registro_id}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
