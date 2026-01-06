import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Search, 
  Plus, 
  Loader2,
  RefreshCw,
  Users,
  Edit,
  Phone,
  Mail,
  Download,
  Building2
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  city?: number;
  cityName?: string;
}

interface AdvboxCustomer {
  id: number;
  name: string;
  tax_id?: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
}

export function AsaasClientes() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [advboxCustomers, setAdvboxCustomers] = useState<AdvboxCustomer[]>([]);
  const [loadingAdvbox, setLoadingAdvbox] = useState(false);
  const [advboxSearch, setAdvboxSearch] = useState('');
  const [importingCustomer, setImportingCustomer] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cpfCnpj: '',
    email: '',
    phone: '',
    mobilePhone: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    postalCode: '',
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { action: 'list_customers', data: { limit: 100 } }
      });

      if (error) throw error;
      setCustomers(data.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const searchCustomers = async () => {
    if (!search.trim()) {
      fetchCustomers();
      return;
    }

    setLoading(true);
    try {
      // Determina se é CPF/CNPJ ou nome
      const isDocument = /^\d+$/.test(search.replace(/\D/g, ''));
      
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'list_customers', 
          data: isDocument ? { cpfCnpj: search.replace(/\D/g, '') } : { name: search }
        }
      });

      if (error) throw error;
      setCustomers(data.data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Carregar clientes do ADVBox para importação
  const loadAdvboxCustomers = async () => {
    setLoadingAdvbox(true);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advbox-integration/customers?limit=200`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        setAdvboxCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes ADVBox:', error);
      toast.error('Erro ao carregar clientes do ADVBox');
    } finally {
      setLoadingAdvbox(false);
    }
  };

  const openImportDialog = () => {
    setImportDialogOpen(true);
    loadAdvboxCustomers();
  };

  const importFromAdvbox = async (advCustomer: AdvboxCustomer) => {
    const cpfCnpj = advCustomer.tax_id || advCustomer.cpf || advCustomer.cnpj;
    if (!cpfCnpj) {
      toast.error('Cliente não possui CPF/CNPJ cadastrado no ADVBox');
      return;
    }

    setImportingCustomer(advCustomer.id.toString());
    try {
      // Verificar se já existe no Asaas
      const { data: searchResult } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'list_customers', 
          data: { cpfCnpj: cpfCnpj.replace(/\D/g, '') }
        }
      });

      if (searchResult?.data?.length > 0) {
        toast.info('Cliente já existe no Asaas');
        setImportingCustomer(null);
        return;
      }

      // Criar no Asaas
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'create_customer', 
          data: {
            name: advCustomer.name,
            cpfCnpj: cpfCnpj.replace(/\D/g, ''),
            email: advCustomer.email,
            phone: advCustomer.phone?.replace(/\D/g, ''),
          }
        }
      });

      if (error) throw error;
      if (data?.errors) {
        throw new Error(data.errors[0]?.description || 'Erro ao criar cliente');
      }

      toast.success('Cliente importado com sucesso!');
      fetchCustomers();
    } catch (error: any) {
      console.error('Erro ao importar cliente:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setImportingCustomer(null);
    }
  };

  const filteredAdvboxCustomers = advboxCustomers.filter(c => 
    c.name.toLowerCase().includes(advboxSearch.toLowerCase())
  ).slice(0, 20);

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      cpfCnpj: '',
      email: '',
      phone: '',
      mobilePhone: '',
      address: '',
      addressNumber: '',
      complement: '',
      province: '',
      postalCode: '',
    });
    setDialogOpen(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      cpfCnpj: customer.cpfCnpj || '',
      email: customer.email || '',
      phone: customer.phone || '',
      mobilePhone: customer.mobilePhone || '',
      address: customer.address || '',
      addressNumber: customer.addressNumber || '',
      complement: customer.complement || '',
      province: customer.province || '',
      postalCode: customer.postalCode || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cpfCnpj) {
      toast.error('Nome e CPF/CNPJ são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const action = editingCustomer ? 'update_customer' : 'create_customer';
      const payload = editingCustomer 
        ? { ...formData, customerId: editingCustomer.id }
        : formData;

      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { action, data: payload }
      });

      if (error) throw error;
      
      if (data.errors) {
        throw new Error(data.errors[0]?.description || 'Erro ao salvar cliente');
      }

      toast.success(editingCustomer ? 'Cliente atualizado!' : 'Cliente criado!');
      setDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const filteredCustomers = customers;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Clientes Asaas</CardTitle>
            <CardDescription>Gerencie clientes cadastrados no Asaas</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex gap-2">
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
                className="w-64"
              />
              <Button variant="outline" onClick={searchCustomers}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={fetchCustomers}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={openImportDialog}>
              <Download className="h-4 w-4 mr-2" />
              Importar ADVBox
            </Button>
            <Button onClick={openNewCustomer}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum cliente encontrado</p>
            <Button variant="outline" className="mt-4" onClick={openNewCustomer}>
              Cadastrar primeiro cliente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCpfCnpj(customer.cpfCnpj)}
                    </TableCell>
                    <TableCell>
                      {customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{customer.email}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(customer.mobilePhone || customer.phone) && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{customer.mobilePhone || customer.phone}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditCustomer(customer)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog Novo/Editar Cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                <Input
                  id="cpfCnpj"
                  value={formData.cpfCnpj}
                  onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                  placeholder="000.000.000-00"
                  disabled={!!editingCustomer}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div>
                <Label htmlFor="mobilePhone">Celular</Label>
                <Input
                  id="mobilePhone"
                  value={formData.mobilePhone}
                  onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="postalCode">CEP</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label htmlFor="addressNumber">Número</Label>
                <Input
                  id="addressNumber"
                  value={formData.addressNumber}
                  onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  placeholder="Apto, Sala..."
                />
              </div>
              <div>
                <Label htmlFor="province">Bairro</Label>
                <Input
                  id="province"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="Bairro"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCustomer ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar do ADVBox */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Importar Clientes do ADVBox
            </DialogTitle>
            <DialogDescription>
              Selecione clientes do ADVBox para importar para o Asaas
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Input
              placeholder="Buscar cliente..."
              value={advboxSearch}
              onChange={(e) => setAdvboxSearch(e.target.value)}
            />

            {loadingAdvbox ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAdvboxCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado no ADVBox</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredAdvboxCustomers.map((customer) => (
                  <div 
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.tax_id || customer.cpf || customer.cnpj || 'Sem CPF/CNPJ'}
                      </p>
                      {customer.email && (
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      )}
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => importFromAdvbox(customer)}
                      disabled={importingCustomer === customer.id.toString()}
                    >
                      {importingCustomer === customer.id.toString() ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Importar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
