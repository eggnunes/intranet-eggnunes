import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  advbox_id: string | null;
  ativo: boolean;
}

export function FinanceiroClientesAdmin() {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formNome, setFormNome] = useState('');
  const [formCpfCnpj, setFormCpfCnpj] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fin_clientes')
        .select('*')
        .order('nome');

      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email?.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf_cnpj?.includes(busca)
  );

  const openDialog = (cliente?: Cliente) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormNome(cliente.nome);
      setFormCpfCnpj(cliente.cpf_cnpj || '');
      setFormEmail(cliente.email || '');
      setFormTelefone(cliente.telefone || '');
    } else {
      setEditingCliente(null);
      setFormNome('');
      setFormCpfCnpj('');
      setFormEmail('');
      setFormTelefone('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        nome: formNome.trim(),
        cpf_cnpj: formCpfCnpj.trim() || null,
        email: formEmail.trim() || null,
        telefone: formTelefone.trim() || null
      };

      if (editingCliente) {
        const { error } = await supabase
          .from('fin_clientes')
          .update(data)
          .eq('id', editingCliente.id);

        if (error) throw error;
        toast.success('Cliente atualizado');
      } else {
        const { error } = await supabase
          .from('fin_clientes')
          .insert(data);

        if (error) throw error;
        toast.success('Cliente criado');
      }

      setShowDialog(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja inativar este cliente?')) return;

    try {
      const { error } = await supabase
        .from('fin_clientes')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Cliente inativado');
      fetchData();
    } catch (error) {
      console.error('Erro ao inativar cliente:', error);
      toast.error('Erro ao inativar cliente');
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('fin_clientes')
        .update({ ativo: !ativo })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Cliente ${ativo ? 'inativado' : 'ativado'}`);
      fetchData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Gerencie os clientes para o sistema financeiro</CardDescription>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Busca */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.id} className={!cliente.ativo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell>{cliente.cpf_cnpj || '-'}</TableCell>
                  <TableCell>{cliente.email || '-'}</TableCell>
                  <TableCell>{cliente.telefone || '-'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={cliente.ativo ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleAtivo(cliente.id, cliente.ativo)}
                    >
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(cliente)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cliente.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          Total: {filteredClientes.length} cliente(s)
        </p>
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={formCpfCnpj} onChange={(e) => setFormCpfCnpj(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
