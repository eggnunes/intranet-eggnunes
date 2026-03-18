
import { useState, useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock, CheckCircle, AlertCircle, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ViabilidadeCliente = {
  id: string;
  nome: string;
  cpf: string;
  status: string;
  observacoes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; className: string }> = {
  pendente: { label: 'Pendente', variant: 'destructive', icon: AlertCircle, className: 'bg-destructive text-destructive-foreground' },
  em_analise: { label: 'Em Análise', variant: 'outline', icon: Clock, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  revisado: { label: 'Revisado', variant: 'default', icon: CheckCircle, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
};

function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`;
}

export default function Viabilidade() {
  const { profile, isAdmin } = useUserRole();
  const [clientes, setClientes] = useState<ViabilidadeCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ViabilidadeCliente | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formStatus, setFormStatus] = useState('pendente');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

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

  const filtered = clientes.filter((c) => {
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || c.nome.toLowerCase().includes(q) || c.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
    return matchStatus && matchSearch;
  });

  const displayClientes = filtered.slice(0, 10);

  const stats = {
    total: clientes.length,
    em_analise: clientes.filter((c) => c.status === 'em_analise').length,
    revisado: clientes.filter((c) => c.status === 'revisado').length,
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

  const statCards = [
    { label: 'Total Clientes', value: stats.total, icon: Users, className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400' },
    { label: 'Em Análise', value: stats.em_analise, icon: Clock, className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    { label: 'Revisados', value: stats.revisado, icon: CheckCircle, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
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
                      <SelectItem value="revisado">Revisado</SelectItem>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="revisado">Revisado</SelectItem>
            </SelectContent>
          </Select>
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
                          <TableCell className="font-medium">{c.nome}</TableCell>
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
    </Layout>
  );
}
