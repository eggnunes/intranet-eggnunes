import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Loader2, Eye, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  tabela: string;
  registro_id: string;
  acao: string;
  dados_anteriores: any;
  dados_novos: any;
  usuario_id: string;
  created_at: string;
  usuario?: {
    full_name: string;
  };
}

export function FinanceiroAuditoria() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filtroTabela, setFiltroTabela] = useState('todos');
  const [filtroAcao, setFiltroAcao] = useState('todos');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fin_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (filtroTabela !== 'todos') {
        query = query.eq('tabela', filtroTabela);
      }
      if (filtroAcao !== 'todos') {
        query = query.eq('acao', filtroAcao);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = [...new Set((data || []).map(l => l.usuario_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]));

      setLogs((data || []).map(log => ({
        ...log,
        usuario: { full_name: profileMap.get(log.usuario_id) || 'Desconhecido' }
      })));
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filtroTabela, filtroAcao, page]);

  const getAcaoBadge = (acao: string) => {
    switch (acao) {
      case 'criar':
        return <Badge className="bg-green-500">Criar</Badge>;
      case 'editar':
        return <Badge className="bg-blue-500">Editar</Badge>;
      case 'deletar':
        return <Badge variant="destructive">Deletar</Badge>;
      case 'restaurar':
        return <Badge className="bg-purple-500">Restaurar</Badge>;
      default:
        return <Badge variant="outline">{acao}</Badge>;
    }
  };

  const getTabelaLabel = (tabela: string) => {
    const labels: Record<string, string> = {
      'fin_lancamentos': 'Lançamentos',
      'fin_categorias': 'Categorias',
      'fin_subcategorias': 'Subcategorias',
      'fin_contas': 'Contas',
      'fin_clientes': 'Clientes',
      'fin_setores': 'Setores'
    };
    return labels[tabela] || tabela;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Auditoria
            </CardTitle>
            <CardDescription>Histórico de alterações no sistema financeiro</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-6">
          <Select value={filtroTabela} onValueChange={setFiltroTabela}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as tabelas</SelectItem>
              <SelectItem value="fin_lancamentos">Lançamentos</SelectItem>
              <SelectItem value="fin_categorias">Categorias</SelectItem>
              <SelectItem value="fin_subcategorias">Subcategorias</SelectItem>
              <SelectItem value="fin_contas">Contas</SelectItem>
              <SelectItem value="fin_clientes">Clientes</SelectItem>
              <SelectItem value="fin_setores">Setores</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ações</SelectItem>
              <SelectItem value="criar">Criar</SelectItem>
              <SelectItem value="editar">Editar</SelectItem>
              <SelectItem value="deletar">Deletar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum registro de auditoria encontrado</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{log.usuario?.full_name}</TableCell>
                    <TableCell>{getAcaoBadge(log.acao)}</TableCell>
                    <TableCell>{getTabelaLabel(log.tabela)}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="text-xs text-muted-foreground truncate">
                        {log.dados_novos?.descricao || log.dados_novos?.nome || log.registro_id.slice(0, 8)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginação */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {logs.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm">Página {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < pageSize}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
