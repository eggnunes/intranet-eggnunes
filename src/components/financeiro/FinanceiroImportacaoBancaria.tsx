import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Download,
  RefreshCw,
  Trash2,
  FileText
} from 'lucide-react';

interface Conta {
  id: string;
  nome: string;
}

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
}

interface ImportacaoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  status: string;
  identificador_banco: string | null;
}

interface Importacao {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  total_registros: number;
  registros_importados: number;
  registros_duplicados: number;
  status: string;
  created_at: string;
  conta: { nome: string } | null;
}

export function FinanceiroImportacaoBancaria() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [loading, setLoading] = useState(false);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [itensParaImportar, setItensParaImportar] = useState<ImportacaoItem[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set());
  const [showRevisaoDialog, setShowRevisaoDialog] = useState(false);
  const [importacaoAtualId, setImportacaoAtualId] = useState<string | null>(null);
  const [categoriasPorItem, setCategoriasPorItem] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchContas();
    fetchCategorias();
    fetchImportacoes();
  }, []);

  const fetchContas = async () => {
    const { data } = await supabase
      .from('fin_contas')
      .select('id, nome')
      .eq('ativa', true);
    setContas(data || []);
  };

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from('fin_categorias')
      .select('id, nome, tipo')
      .eq('ativa', true)
      .order('nome');
    setCategorias(data || []);
  };

  const fetchImportacoes = async () => {
    const { data } = await supabase
      .from('fin_importacoes')
      .select('*, conta:fin_contas(nome)')
      .order('created_at', { ascending: false })
      .limit(20);
    setImportacoes(data || []);
  };

  const parseCSV = (content: string): ImportacaoItem[] => {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const items: ImportacaoItem[] = [];
    // Tenta detectar o formato do CSV
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/"/g, ''));
      if (cols.length >= 3) {
        // Formato esperado: Data, Descrição, Valor (ou variações)
        const dataStr = cols[0];
        const descricao = cols[1] || 'Sem descrição';
        const valorStr = cols[2]?.replace(/[^\d,.-]/g, '').replace(',', '.') || '0';
        const valor = Math.abs(parseFloat(valorStr));
        
        if (!isNaN(valor) && valor > 0) {
          const isCredito = parseFloat(valorStr) > 0 || cols[3]?.toLowerCase() === 'c';
          items.push({
            id: `temp-${i}`,
            data_transacao: formatDate(dataStr),
            descricao,
            valor,
            tipo: isCredito ? 'credito' : 'debito',
            status: 'pendente',
            identificador_banco: `${dataStr}-${descricao}-${valorStr}`
          });
        }
      }
    }
    return items;
  };

  const parseOFX = (content: string): ImportacaoItem[] => {
    const items: ImportacaoItem[] = [];
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const trans = match[1];
      
      const dtPosted = trans.match(/<DTPOSTED>(\d+)/)?.[1] || '';
      const trnAmt = trans.match(/<TRNAMT>([+-]?\d+\.?\d*)/)?.[1] || '0';
      const memo = trans.match(/<MEMO>([^<]+)/)?.[1] || '';
      const name = trans.match(/<NAME>([^<]+)/)?.[1] || '';
      const fitid = trans.match(/<FITID>([^<]+)/)?.[1] || '';

      const valor = Math.abs(parseFloat(trnAmt));
      if (valor > 0) {
        items.push({
          id: `temp-${items.length}`,
          data_transacao: formatOFXDate(dtPosted),
          descricao: memo || name || 'Transação OFX',
          valor,
          tipo: parseFloat(trnAmt) > 0 ? 'credito' : 'debito',
          status: 'pendente',
          identificador_banco: fitid || `${dtPosted}-${trnAmt}`
        });
      }
    }
    return items;
  };

  const formatDate = (dateStr: string): string => {
    // Tenta parsear diferentes formatos de data
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/    // DD-MM-YYYY
    ];
    
    for (const fmt of formats) {
      const match = dateStr.match(fmt);
      if (match) {
        if (fmt === formats[0]) {
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else if (fmt === formats[1]) {
          return dateStr;
        } else {
          return `${match[3]}-${match[2]}-${match[1]}`;
        }
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  const formatOFXDate = (dateStr: string): string => {
    if (dateStr.length >= 8) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contaSelecionada) {
      toast.error('Selecione uma conta antes de importar');
      return;
    }

    setLoading(true);
    try {
      const content = await file.text();
      const isOFX = file.name.toLowerCase().endsWith('.ofx');
      const items = isOFX ? parseOFX(content) : parseCSV(content);

      if (items.length === 0) {
        toast.error('Nenhuma transação encontrada no arquivo');
        return;
      }

      // Criar registro de importação
      const { data: importacao, error } = await supabase
        .from('fin_importacoes')
        .insert({
          nome_arquivo: file.name,
          tipo_arquivo: isOFX ? 'ofx' : 'csv',
          conta_id: contaSelecionada,
          total_registros: items.length,
          status: 'processando',
          imported_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Inserir itens para revisão
      const itensInsert = items.map(item => ({
        importacao_id: importacao.id,
        data_transacao: item.data_transacao,
        descricao: item.descricao,
        valor: item.valor,
        tipo: item.tipo,
        identificador_banco: item.identificador_banco,
        status: 'pendente'
      }));

      const { error: itemsError } = await supabase
        .from('fin_importacao_itens')
        .insert(itensInsert);

      if (itemsError) throw itemsError;

      // Carregar itens para revisão
      const { data: itensCarregados } = await supabase
        .from('fin_importacao_itens')
        .select('*')
        .eq('importacao_id', importacao.id);

      setItensParaImportar(itensCarregados || []);
      setImportacaoAtualId(importacao.id);
      setItensSelecionados(new Set((itensCarregados || []).map(i => i.id)));
      setShowRevisaoDialog(true);
      
      toast.success(`${items.length} transações encontradas para revisão`);
      fetchImportacoes();
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmarImportacao = async () => {
    if (!importacaoAtualId || itensSelecionados.size === 0) {
      toast.error('Selecione pelo menos um item para importar');
      return;
    }

    setLoading(true);
    try {
      const itensParaImportarFinal = itensParaImportar.filter(i => itensSelecionados.has(i.id));
      let importados = 0;
      let duplicados = 0;

      for (const item of itensParaImportarFinal) {
        // Verificar duplicata
        const { data: existente } = await supabase
          .from('fin_lancamentos')
          .select('id')
          .eq('conta_origem_id', contaSelecionada)
          .eq('valor', item.valor)
          .eq('data_lancamento', item.data_transacao)
          .is('deleted_at', null)
          .limit(1);

        if (existente && existente.length > 0) {
          duplicados++;
          await supabase
            .from('fin_importacao_itens')
            .update({ status: 'duplicado' })
            .eq('id', item.id);
          continue;
        }

        // Criar lançamento
        const categoriaId = categoriasPorItem[item.id];
        const { data: lancamento, error } = await supabase
          .from('fin_lancamentos')
          .insert({
            tipo: item.tipo === 'credito' ? 'receita' : 'despesa',
            valor: item.valor,
            descricao: item.descricao,
            data_lancamento: item.data_transacao,
            conta_origem_id: contaSelecionada,
            categoria_id: categoriaId || null,
            status: 'pago',
            created_by: user?.id
          })
          .select()
          .single();

        if (!error && lancamento) {
          importados++;
          await supabase
            .from('fin_importacao_itens')
            .update({ status: 'importado', lancamento_id: lancamento.id })
            .eq('id', item.id);
        }
      }

      // Atualizar status da importação
      await supabase
        .from('fin_importacoes')
        .update({
          status: 'concluido',
          registros_importados: importados,
          registros_duplicados: duplicados
        })
        .eq('id', importacaoAtualId);

      toast.success(`Importação concluída: ${importados} registros, ${duplicados} duplicados`);
      setShowRevisaoDialog(false);
      setItensParaImportar([]);
      setItensSelecionados(new Set());
      setCategoriasPorItem({});
      fetchImportacoes();
    } catch (error) {
      console.error('Erro ao confirmar importação:', error);
      toast.error('Erro ao confirmar importação');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelecionado = (id: string) => {
    const novos = new Set(itensSelecionados);
    if (novos.has(id)) {
      novos.delete(id);
    } else {
      novos.add(id);
    }
    setItensSelecionados(novos);
  };

  const toggleTodos = () => {
    if (itensSelecionados.size === itensParaImportar.length) {
      setItensSelecionados(new Set());
    } else {
      setItensSelecionados(new Set(itensParaImportar.map(i => i.id)));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'processando':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'erro':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário
          </CardTitle>
          <CardDescription>
            Importe arquivos OFX ou CSV do seu banco para conciliação automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta de Destino</Label>
              <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo (OFX ou CSV)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv"
                onChange={handleFileUpload}
                disabled={loading || !contaSelecionada}
              />
            </div>
          </div>

          <div className="flex gap-2 p-4 bg-muted rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Formatos suportados:</p>
              <ul className="list-disc list-inside text-muted-foreground">
                <li><strong>OFX:</strong> Formato padrão de extratos bancários</li>
                <li><strong>CSV:</strong> Colunas: Data, Descrição, Valor (separado por ; ou ,)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Importações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Histórico de Importações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Importados</TableHead>
                <TableHead>Duplicados</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importacoes.map(imp => (
                <TableRow key={imp.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {imp.nome_arquivo}
                    </div>
                  </TableCell>
                  <TableCell>{imp.conta?.nome || '-'}</TableCell>
                  <TableCell>{imp.total_registros}</TableCell>
                  <TableCell className="text-green-600">{imp.registros_importados}</TableCell>
                  <TableCell className="text-yellow-600">{imp.registros_duplicados}</TableCell>
                  <TableCell>{getStatusBadge(imp.status)}</TableCell>
                  <TableCell>{format(new Date(imp.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                </TableRow>
              ))}
              {importacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma importação realizada ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Revisão */}
      <Dialog open={showRevisaoDialog} onOpenChange={setShowRevisaoDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Revisar Transações para Importação</DialogTitle>
            <DialogDescription>
              Selecione as transações que deseja importar e atribua categorias
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={itensSelecionados.size === itensParaImportar.length}
                      onCheckedChange={toggleTodos}
                    />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensParaImportar.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={itensSelecionados.has(item.id)}
                        onCheckedChange={() => toggleItemSelecionado(item.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(item.data_transacao), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={item.descricao}>
                      {item.descricao}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.tipo === 'credito' ? 'default' : 'destructive'}>
                        {item.tipo === 'credito' ? 'Crédito' : 'Débito'}
                      </Badge>
                    </TableCell>
                    <TableCell className={item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(item.valor)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={categoriasPorItem[item.id] || ''}
                        onValueChange={(v) => setCategoriasPorItem(prev => ({ ...prev, [item.id]: v }))}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias
                            .filter(c => item.tipo === 'credito' ? c.tipo === 'receita' : c.tipo === 'despesa')
                            .map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-4">
            <div className="flex items-center gap-4 w-full justify-between">
              <span className="text-sm text-muted-foreground">
                {itensSelecionados.size} de {itensParaImportar.length} selecionados
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRevisaoDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarImportacao} disabled={loading || itensSelecionados.size === 0}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Confirmar Importação
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
