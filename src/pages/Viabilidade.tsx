
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock, CheckCircle, AlertCircle, Plus, Pencil, Trash2, Search, XCircle, CloudUpload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SaveToTeamsDialog } from '@/components/SaveToTeamsDialog';

type ViabilidadeCliente = {
  id: string;
  nome: string;
  cpf: string;
  status: string;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  tipo_acao?: string | null;
  descricao_caso?: string | null;
  parecer_viabilidade?: string | null;
  titulo?: string | null;
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; className: string }> = {
  pendente: { label: 'Pendente', variant: 'destructive', icon: AlertCircle, className: 'bg-destructive text-destructive-foreground' },
  em_analise: { label: 'Em Análise', variant: 'outline', icon: Clock, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  viavel: { label: 'Viável', variant: 'default', icon: CheckCircle, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  inviavel: { label: 'Inviável', variant: 'destructive', icon: XCircle, className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
};

function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`;
}

export default function Viabilidade() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useUserRole();
  const [clientes, setClientes] = useState<ViabilidadeCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterProduto, setFilterProduto] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ViabilidadeCliente | null>(null);
  const [viewingCliente, setViewingCliente] = useState<ViabilidadeCliente | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formStatus, setFormStatus] = useState('pendente');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  // Teams dialog state
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [teamsFileName, setTeamsFileName] = useState('');
  const [teamsFileContent, setTeamsFileContent] = useState('');
  const [teamsClientName, setTeamsClientName] = useState('');

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('viabilidade_clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error('Erro ao carregar clientes');
    } else {
      setClientes(data || []);
    }
    setLoading(false);
  };

  const produtoOptions = [...new Set(clientes.map(c => c.tipo_acao).filter(Boolean))] as string[];

  const filtered = clientes.filter((c) => {
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    const matchProduto = filterProduto === 'todos' || c.tipo_acao === filterProduto;
    const q = search.toLowerCase();
    const matchSearch = !q || c.nome.toLowerCase().includes(q) || c.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || (c.titulo?.toLowerCase().includes(q));
    return matchStatus && matchProduto && matchSearch;
  });

  const displayClientes = filtered.slice(0, 10);

  const stats = {
    total: clientes.length,
    em_analise: clientes.filter((c) => c.status === 'em_analise').length,
    viavel: clientes.filter((c) => c.status === 'viavel').length,
    inviavel: clientes.filter((c) => c.status === 'inviavel').length,
    pendente: clientes.filter((c) => c.status === 'pendente').length,
  };

  const openNewDialog = () => {
    setEditingCliente(null);
    setFormNome('');
    setFormCpf('');
    setFormStatus('pendente');
    setFormObservacoes('');
    setDialogOpen(true);
  };

  const openEditDialog = (cliente: ViabilidadeCliente) => {
    setEditingCliente(cliente);
    setFormNome(cliente.nome);
    setFormCpf(cliente.cpf);
    setFormStatus(cliente.status);
    setFormObservacoes(cliente.observacoes || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formNome.trim() || !formCpf.trim()) {
      toast.error('Nome e CPF são obrigatórios');
      return;
    }
    setSaving(true);

    if (editingCliente) {
      const { error } = await supabase
        .from('viabilidade_clientes')
        .update({ nome: formNome, cpf: formCpf, status: formStatus, observacoes: formObservacoes || null })
        .eq('id', editingCliente.id);

      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Cliente atualizado!'); setDialogOpen(false); fetchClientes(); }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Usuário não autenticado'); setSaving(false); return; }

      const { error } = await supabase
        .from('viabilidade_clientes')
        .insert({ nome: formNome, cpf: formCpf, status: formStatus, observacoes: formObservacoes || null, created_by: user.id });

      if (error) toast.error('Erro ao salvar');
      else { toast.success('Cliente cadastrado!'); setDialogOpen(false); fetchClientes(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    const { error } = await supabase.from('viabilidade_clientes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Cliente excluído'); fetchClientes(); }
  };

  const handleMarkViavel = async (id: string) => {
    const { error } = await supabase.from('viabilidade_clientes').update({ status: 'viavel' }).eq('id', id);
    if (error) toast.error('Erro ao atualizar status');
    else { toast.success('Cliente marcado como viável!'); fetchClientes(); }
  };

  const handleMarkInviavel = async (id: string) => {
    const { error } = await supabase.from('viabilidade_clientes').update({ status: 'inviavel' }).eq('id', id);
    if (error) toast.error('Erro ao atualizar status');
    else { toast.success('Cliente marcado como inviável!'); fetchClientes(); }
  };

  const handleSaveToTeams = (cliente: ViabilidadeCliente) => {
    const statusLabel = statusConfig[cliente.status]?.label || cliente.status;
    const dataFormatada = format(new Date(cliente.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const content = [
      '=== ANÁLISE DE VIABILIDADE JURÍDICA ===',
      '',
      `Nome: ${cliente.nome}`,
      `CPF: ${cliente.cpf}`,
      `Status: ${statusLabel}`,
      `Tipo de Ação: ${cliente.tipo_acao || 'Não informado'}`,
      `Data de Cadastro: ${dataFormatada}`,
      '',
      '--- Descrição do Caso ---',
      cliente.descricao_caso || 'Não informado',
      '',
      '--- Parecer de Viabilidade ---',
      cliente.parecer_viabilidade || 'Nenhum parecer registrado',
      '',
      '--- Observações ---',
      cliente.observacoes || 'Nenhuma observação',
      '',
      `Documento gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    ].join('\n');

    const base64 = btoa(unescape(encodeURIComponent(content)));

    setTeamsFileName(`Viabilidade - ${cliente.nome}.txt`);
    setTeamsFileContent(base64);
    setTeamsClientName(cliente.nome);
    setTeamsDialogOpen(true);
  };

  const statCards = [
    { label: 'Total Clientes', value: stats.total, icon: Users, className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    { label: 'Em Análise', value: stats.em_analise, icon: Clock, className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    { label: 'Viáveis', value: stats.viavel, icon: CheckCircle, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    { label: 'Inviáveis', value: stats.inviavel, icon: XCircle, className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
    { label: 'Pendentes', value: stats.pendente, icon: AlertCircle, className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  ];

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard de Viabilidade</h1>
            <p className="text-sm text-muted-foreground">Gerencie a análise de viabilidade dos clientes</p>
          </div>
          <Button onClick={() => navigate('/viabilidade/novo')}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><span /></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome *</Label>
                  <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input value={formCpf} onChange={(e) => setFormCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_analise">Em Análise</SelectItem>
                      <SelectItem value="viavel">Viável</SelectItem>
                      <SelectItem value="inviavel">Inviável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={formObservacoes} onChange={(e) => setFormObservacoes(e.target.value)} placeholder="Observações sobre o cliente..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className={`border ${s.className}`}>
              <CardContent className="flex items-center gap-4 p-5">
                <s.icon className="h-8 w-8 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium opacity-80">{s.label}</p>
                  <p className="text-3xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="viavel">Viável</SelectItem>
              <SelectItem value="inviavel">Inviável</SelectItem>
            </SelectContent>
          </Select>
          {produtoOptions.length > 0 && (
            <Select value={filterProduto} onValueChange={setFilterProduto}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Produtos</SelectItem>
                {produtoOptions.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : displayClientes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Título/Produto</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Criação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayClientes.map((c) => {
                      const cfg = statusConfig[c.status] || statusConfig.pendente;
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <button
                              className="font-medium text-primary underline cursor-pointer hover:text-primary/80 text-left"
                              onClick={() => setViewingCliente(c)}
                            >
                              {c.nome}
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{maskCpf(c.cpf)}</TableCell>
                          <TableCell>
                            <Badge className={`gap-1 ${cfg.className}`}>
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {c.status === 'em_analise' && (
                              <>
                                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => handleMarkViavel(c.id)}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Viável
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-500/30 hover:bg-red-500/10" onClick={() => handleMarkInviavel(c.id)}>
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Inviável
                                </Button>
                              </>
                            )}
                            {c.parecer_viabilidade && (
                              <Button size="sm" variant="outline" onClick={() => handleSaveToTeams(c)} title="Salvar análise no Teams">
                                <CloudUpload className="h-3.5 w-3.5 mr-1" />
                                Teams
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
      </div>

      {/* Dialog de visualização da análise */}
      <Dialog open={!!viewingCliente} onOpenChange={(open) => !open && setViewingCliente(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Análise de Viabilidade</DialogTitle>
          </DialogHeader>
          {viewingCliente && (() => {
            const cfg = statusConfig[viewingCliente.status] || statusConfig.pendente;
            const StatusIcon = cfg.icon;
            return (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{viewingCliente.nome}</h3>
                    <p className="text-sm text-muted-foreground">CPF: {viewingCliente.cpf}</p>
                  </div>
                  <Badge className={`gap-1 ${cfg.className}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                </div>

                {viewingCliente.tipo_acao && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo de Ação</Label>
                    <p className="text-sm text-foreground">{viewingCliente.tipo_acao}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Data de Cadastro</Label>
                  <p className="text-sm text-foreground">
                    {format(new Date(viewingCliente.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {viewingCliente.descricao_caso && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Descrição do Caso</Label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{viewingCliente.descricao_caso}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Parecer de Viabilidade</Label>
                  {viewingCliente.parecer_viabilidade ? (
                    <div className="mt-1 p-4 rounded-md border bg-muted/50 text-sm text-foreground">
                      {viewingCliente.parecer_viabilidade.split('\n').map((line, i) => {
                        const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
                        if (boldMatch) {
                          return <p key={i} className="mt-2 first:mt-0"><strong>{boldMatch[1]}</strong>{boldMatch[2]}</p>;
                        }
                        if (line.startsWith('- ')) {
                          return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
                        }
                        if (line.trim() === '') return <br key={i} />;
                        return <p key={i}>{line}</p>;
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mt-1">Nenhuma análise realizada ainda.</p>
                  )}
                </div>

                {viewingCliente.observacoes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Observações</Label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{viewingCliente.observacoes}</p>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            {viewingCliente?.parecer_viabilidade && (
              <Button variant="outline" onClick={() => { handleSaveToTeams(viewingCliente!); }}>
                <CloudUpload className="h-4 w-4 mr-2" />
                Salvar no Teams
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewingCliente(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveToTeamsDialog
        open={teamsDialogOpen}
        onOpenChange={setTeamsDialogOpen}
        fileName={teamsFileName}
        fileContent={teamsFileContent}
        clientName={teamsClientName}
        onSuccess={() => toast.success('Análise salva no Teams com sucesso!')}
      />
    </Layout>
  );
}
