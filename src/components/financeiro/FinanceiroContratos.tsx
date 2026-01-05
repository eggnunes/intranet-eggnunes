import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileSignature, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contrato {
  id: string;
  client_id: number;
  client_name: string;
  client_cpf: string | null;
  client_email: string | null;
  client_phone: string | null;
  product_name: string;
  objeto_contrato: string | null;
  valor_total: number | null;
  forma_pagamento: string | null;
  numero_parcelas: number | null;
  valor_parcela: number | null;
  valor_entrada: number | null;
  data_vencimento: string | null;
  tem_honorarios_exito: boolean | null;
  descricao_exito: string | null;
  advbox_customer_id: string | null;
  advbox_lawsuit_id: string | null;
  advbox_sync_status: string | null;
  advbox_sync_error: string | null;
  status: string | null;
  created_at: string;
}

export const FinanceiroContratos = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [syncFilter, setSyncFilter] = useState<string>("todos");

  useEffect(() => {
    loadContratos();
  }, []);

  const loadContratos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fin_contratos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContratos(data || []);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  const filteredContratos = contratos.filter(contrato => {
    const matchesSearch = 
      contrato.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contrato.client_cpf && contrato.client_cpf.includes(searchTerm));
    
    const matchesStatus = statusFilter === "todos" || contrato.status === statusFilter;
    const matchesSync = syncFilter === "todos" || contrato.advbox_sync_status === syncFilter;
    
    return matchesSearch && matchesStatus && matchesSync;
  });

  // Calcular estatísticas
  const totalContratos = contratos.length;
  const valorTotalContratos = contratos.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const contratosSincronizados = contratos.filter(c => c.advbox_sync_status === 'synced').length;
  const contratosAtivos = contratos.filter(c => c.status === 'ativo').length;

  const getSyncStatusBadge = (status: string | null) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'ativo':
        return <Badge variant="default">Ativo</Badge>;
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'finalizado':
        return <Badge variant="secondary">Finalizado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContratos}</div>
            <p className="text-xs text-muted-foreground">{contratosAtivos} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valorTotalContratos)}</div>
            <p className="text-xs text-muted-foreground">Soma dos contratos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sincronizados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contratosSincronizados}</div>
            <p className="text-xs text-muted-foreground">
              {totalContratos > 0 ? Math.round((contratosSincronizados / totalContratos) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalContratos > 0 ? valorTotalContratos / totalContratos : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Por contrato</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Contratos Registrados
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadContratos} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por cliente, produto ou CPF..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={syncFilter} onValueChange={setSyncFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sincronização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Sincronizações</SelectItem>
                <SelectItem value="synced">Sincronizado</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela de Contratos */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Forma Pagto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ADVBOX</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredContratos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContratos.map((contrato) => (
                    <TableRow key={contrato.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{contrato.client_name}</div>
                          {contrato.client_cpf && (
                            <div className="text-xs text-muted-foreground">{contrato.client_cpf}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={contrato.product_name}>
                          {contrato.product_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(contrato.valor_total)}
                        {contrato.numero_parcelas && contrato.numero_parcelas > 1 && (
                          <div className="text-xs text-muted-foreground">
                            {contrato.numero_parcelas}x de {formatCurrency(contrato.valor_parcela)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {contrato.forma_pagamento || '-'}
                        {contrato.valor_entrada && (
                          <div className="text-xs text-muted-foreground">
                            Entrada: {formatCurrency(contrato.valor_entrada)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(contrato.status)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getSyncStatusBadge(contrato.advbox_sync_status)}
                          {contrato.advbox_customer_id && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" /> 
                              Cliente: {contrato.advbox_customer_id}
                            </div>
                          )}
                          {contrato.advbox_lawsuit_id && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileSignature className="h-3 w-3" /> 
                              Processo: {contrato.advbox_lawsuit_id}
                            </div>
                          )}
                          {contrato.advbox_sync_error && (
                            <div className="text-xs text-red-600 max-w-[200px] truncate" title={contrato.advbox_sync_error}>
                              {contrato.advbox_sync_error}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(contrato.created_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredContratos.length > 0 && (
            <div className="text-sm text-muted-foreground mt-2">
              Exibindo {filteredContratos.length} de {contratos.length} contratos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
