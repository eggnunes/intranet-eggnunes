import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { 
  Loader2, 
  Search, 
  FileText, 
  CreditCard,
  QrCode,
  Plus,
  Users,
  Building2,
  RefreshCw
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  source?: 'asaas' | 'advbox' | 'local' | 'contrato';
  productName?: string;
}

interface AdvboxCustomer {
  id: number;
  name: string;
  tax_id?: string;
  cpf?: string;
  cnpj?: string;
}

interface LocalCustomer {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email?: string | null;
  telefone?: string | null;
}

interface ContractCustomer {
  id: string;
  client_name: string;
  client_cpf: string | null;
  client_email: string | null;
  client_phone: string | null;
  product_name: string | null;
}

interface AsaasNovaCobrancaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AsaasNovaCobranca({ open, onOpenChange, onSuccess }: AsaasNovaCobrancaProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [syncingCustomer, setSyncingCustomer] = useState(false);
  
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSource, setCustomerSource] = useState<'asaas' | 'advbox' | 'local' | 'contrato'>('asaas');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // ADVBox, Local e Contract customers cache
  const [advboxCustomers, setAdvboxCustomers] = useState<AdvboxCustomer[]>([]);
  const [localCustomers, setLocalCustomers] = useState<LocalCustomer[]>([]);
  const [contractCustomers, setContractCustomers] = useState<ContractCustomer[]>([]);
  const [loadingAdvbox, setLoadingAdvbox] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(false);
  
  // Form data
  const [billingType, setBillingType] = useState<'BOLETO' | 'CREDIT_CARD' | 'PIX'>('BOLETO');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [installmentCount, setInstallmentCount] = useState('1');
  
  // Opcionais
  const [discountValue, setDiscountValue] = useState('');
  const [discountDays, setDiscountDays] = useState('0');
  const [fineValue, setFineValue] = useState('');
  const [interestValue, setInterestValue] = useState('');

  const resetForm = () => {
    setStep(1);
    setCustomerSearch('');
    setCustomers([]);
    setSelectedCustomer(null);
    setCustomerSource('asaas');
    setBillingType('BOLETO');
    setValue('');
    setDueDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setInstallmentCount('1');
    setDiscountValue('');
    setDiscountDays('0');
    setFineValue('');
    setInterestValue('');
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Carregar clientes do ADVBox (do banco local)
  const loadAdvboxCustomers = async () => {
    setLoadingAdvbox(true);
    try {
      const { data, error } = await supabase
        .from('advbox_customers' as any)
        .select('advbox_id, name, tax_id, cpf, cnpj, email, phone')
        .order('name');
      
      if (!error && data) {
        setAdvboxCustomers((data as any[]).map((c: any) => ({
          id: c.advbox_id,
          name: c.name,
          tax_id: c.tax_id,
          cpf: c.cpf,
          cnpj: c.cnpj,
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes ADVBox:', error);
    } finally {
      setLoadingAdvbox(false);
    }
  };

  // Forçar sincronização manual dos clientes ADVBox
  const syncAdvboxCustomers = async () => {
    setLoadingAdvbox(true);
    try {
      toast.info('Sincronizando clientes do ADVBox... Isso pode levar alguns minutos.');
      const { error } = await supabase.functions.invoke('sync-advbox-customers');
      if (error) throw error;
      toast.success('Sincronização iniciada! Recarregando lista...');
      await loadAdvboxCustomers();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar clientes do ADVBox');
      setLoadingAdvbox(false);
    }
  };

  // Carregar clientes locais do sistema financeiro
  const loadLocalCustomers = async () => {
    setLoadingLocal(true);
    try {
      const { data, error } = await supabase
        .from('fin_clientes')
        .select('id, nome, cpf_cnpj, email, telefone')
        .eq('ativo', true)
        .order('nome');
      
      if (!error && data) {
        setLocalCustomers(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes locais:', error);
    } finally {
      setLoadingLocal(false);
    }
  };

  // Carregar clientes de contratos
  const loadContractCustomers = async () => {
    setLoadingContracts(true);
    try {
      const { data, error } = await supabase
        .from('fin_contratos')
        .select('id, client_name, client_cpf, client_email, client_phone, product_name')
        .in('status', ['ativo', 'pendente'])
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setContractCustomers(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes de contratos:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  // Carregar dados ao abrir o dialog
  useEffect(() => {
    if (open) {
      loadAdvboxCustomers();
      loadLocalCustomers();
      loadContractCustomers();
    }
  }, [open]);

  // Buscar clientes no Asaas
  const searchAsaasCustomers = async () => {
    if (!customerSearch.trim()) return;

    setSearchingCustomer(true);
    try {
      const isDocument = /^\d+$/.test(customerSearch.replace(/\D/g, ''));
      
      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'list_customers', 
          data: isDocument 
            ? { cpfCnpj: customerSearch.replace(/\D/g, '') } 
            : { name: customerSearch }
        }
      });

      if (error) throw error;
      const asaasCustomers = (data.data || []).map((c: any) => ({
        ...c,
        source: 'asaas' as const
      }));
      setCustomers(asaasCustomers);
    } catch (error: any) {
      toast.error('Erro ao buscar clientes Asaas');
    } finally {
      setSearchingCustomer(false);
    }
  };

  // Normalizar texto removendo acentos para busca flexível
  const normalize = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Filtrar clientes baseado na fonte selecionada
  const getFilteredCustomers = (): Customer[] => {
    const searchNorm = normalize(customerSearch);
    const searchDigits = customerSearch.replace(/\D/g, '');
    
    if (customerSource === 'asaas') {
      return customers;
    }
    
    if (customerSource === 'advbox') {
      return advboxCustomers
        .filter(c => {
          if (!searchNorm) return true;
          if (normalize(c.name).includes(searchNorm)) return true;
          if (searchDigits && (c.tax_id?.replace(/\D/g, '').includes(searchDigits) || c.cpf?.replace(/\D/g, '').includes(searchDigits) || c.cnpj?.replace(/\D/g, '').includes(searchDigits))) return true;
          return false;
        })
        .slice(0, 30)
        .map(c => ({
          id: `advbox_${c.id}`,
          name: c.name,
          cpfCnpj: c.tax_id || c.cpf || c.cnpj || '',
          source: 'advbox' as const
        }));
    }
    
    if (customerSource === 'local') {
      return localCustomers
        .filter(c => {
          if (!searchNorm) return true;
          if (normalize(c.nome).includes(searchNorm)) return true;
          if (searchDigits && c.cpf_cnpj?.replace(/\D/g, '').includes(searchDigits)) return true;
          if (c.email && normalize(c.email).includes(searchNorm)) return true;
          if (c.telefone && c.telefone.replace(/\D/g, '').includes(searchDigits)) return true;
          return false;
        })
        .slice(0, 30)
        .map(c => ({
          id: `local_${c.id}`,
          name: c.nome,
          cpfCnpj: c.cpf_cnpj || '',
          email: c.email || undefined,
          phone: c.telefone || undefined,
          source: 'local' as const
        }));
    }

    if (customerSource === 'contrato') {
      return contractCustomers
        .filter(c => {
          if (!searchNorm) return true;
          if (normalize(c.client_name).includes(searchNorm)) return true;
          if (searchDigits && c.client_cpf?.replace(/\D/g, '').includes(searchDigits)) return true;
          if (c.client_email && normalize(c.client_email).includes(searchNorm)) return true;
          return false;
        })
        .slice(0, 30)
        .map(c => ({
          id: `contrato_${c.id}`,
          name: c.client_name,
          cpfCnpj: c.client_cpf || '',
          email: c.client_email || undefined,
          phone: c.client_phone || undefined,
          source: 'contrato' as const,
          productName: c.product_name || undefined
        }));
    }
    
    return [];
  };

  // Sincronizar cliente com Asaas (criar se não existir)
  const syncCustomerToAsaas = async (customer: Customer): Promise<string | null> => {
    if (customer.source === 'asaas') {
      return customer.id;
    }

    if (!customer.cpfCnpj) {
      toast.error('Cliente precisa ter CPF/CNPJ para criar cobrança');
      return null;
    }

    setSyncingCustomer(true);
    try {
      // Primeiro, verificar se já existe no Asaas pelo CPF/CNPJ
      const { data: searchResult } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'list_customers', 
          data: { cpfCnpj: customer.cpfCnpj.replace(/\D/g, '') }
        }
      });

      if (searchResult?.data?.length > 0) {
        return searchResult.data[0].id;
      }

      // Criar cliente no Asaas (incluindo email e telefone quando disponíveis)
      const createData: Record<string, string> = {
        name: customer.name,
        cpfCnpj: customer.cpfCnpj.replace(/\D/g, ''),
      };
      if (customer.email) createData.email = customer.email;
      if (customer.phone) createData.phone = customer.phone;

      const { data: createResult, error } = await supabase.functions.invoke('asaas-integration', {
        body: { 
          action: 'create_customer', 
          data: createData
        }
      });

      if (error) throw error;
      if (createResult?.errors) {
        throw new Error(createResult.errors[0]?.description || 'Erro ao criar cliente no Asaas');
      }

      toast.success('Cliente sincronizado com Asaas!');
      return createResult.id;
    } catch (error: any) {
      console.error('Erro ao sincronizar cliente:', error);
      toast.error('Erro ao sincronizar cliente: ' + error.message);
      return null;
    } finally {
      setSyncingCustomer(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Selecione um cliente');
      return;
    }

    const numValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    const numInstallments = parseInt(installmentCount);
    if (billingType === 'CREDIT_CARD' && (numInstallments < 1 || numInstallments > 21)) {
      toast.error('Número de parcelas inválido (1-21)');
      return;
    }

    setSaving(true);
    try {
      // Se o cliente não é do Asaas, sincronizar primeiro
      let asaasCustomerId = selectedCustomer.id;
      if (selectedCustomer.source !== 'asaas') {
        const syncedId = await syncCustomerToAsaas(selectedCustomer);
        if (!syncedId) {
          setSaving(false);
          return;
        }
        asaasCustomerId = syncedId;
      }

      const paymentData: Record<string, any> = {
        customer: asaasCustomerId,
        billingType,
        dueDate,
        description,
      };

      // Parcelamento
      if (numInstallments > 1) {
        paymentData.installmentCount = numInstallments;
        paymentData.installmentValue = numValue / numInstallments;
      } else {
        paymentData.value = numValue;
      }

      // Desconto
      if (discountValue) {
        const discountNum = parseFloat(discountValue.replace(',', '.'));
        if (discountNum > 0) {
          paymentData.discount = {
            value: discountNum,
            dueDateLimitDays: parseInt(discountDays) || 0,
          };
        }
      }

      // Multa
      if (fineValue) {
        const fineNum = parseFloat(fineValue.replace(',', '.'));
        if (fineNum > 0) {
          paymentData.fine = { value: fineNum };
        }
      }

      // Juros
      if (interestValue) {
        const interestNum = parseFloat(interestValue.replace(',', '.'));
        if (interestNum > 0) {
          paymentData.interest = { value: interestNum };
        }
      }

      console.log('Creating payment:', paymentData);

      const { data, error } = await supabase.functions.invoke('asaas-integration', {
        body: { action: 'create_payment', data: paymentData }
      });

      if (error) throw error;
      
      if (data.errors) {
        throw new Error(data.errors[0]?.description || 'Erro ao criar cobrança');
      }

      toast.success('Cobrança criada com sucesso!');
      
      // Mostrar link da fatura
      if (data.invoiceUrl) {
        toast.info(
          <div className="flex flex-col gap-2">
            <span>Link da fatura criado!</span>
            <a 
              href={data.invoiceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Abrir fatura
            </a>
          </div>,
          { duration: 10000 }
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar cobrança:', error);
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

  const numInstallments = parseInt(installmentCount) || 1;
  const numValue = parseFloat(value.replace(',', '.')) || 0;
  const installmentValue = numInstallments > 1 ? numValue / numInstallments : numValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Selecione o cliente' : 'Configure a cobrança'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {/* Seletor de fonte de clientes */}
            <div>
              <Label className="mb-2 block">Buscar cliente em:</Label>
              <Tabs value={customerSource} onValueChange={(v) => setCustomerSource(v as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="asaas" className="text-xs">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Asaas
                  </TabsTrigger>
                  <TabsTrigger value="advbox" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    ADVBox
                  </TabsTrigger>
                  <TabsTrigger value="local" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Financeiro
                  </TabsTrigger>
                  <TabsTrigger value="contrato" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Contratos
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && customerSource === 'asaas' && searchAsaasCustomers()}
              />
              {customerSource === 'asaas' && (
                <Button onClick={searchAsaasCustomers} disabled={searchingCustomer}>
                  {searchingCustomer ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Loading indicators and refresh */}
            {customerSource === 'advbox' && (
              <div className="flex items-center gap-2">
                {loadingAdvbox ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando clientes do ADVBox...
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={syncAdvboxCustomers} className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Atualizar lista do ADVBox
                  </Button>
                )}
              </div>
            )}
            {customerSource === 'local' && loadingLocal && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes do sistema financeiro...
              </div>
            )}
            {customerSource === 'contrato' && loadingContracts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes de contratos...
              </div>
            )}

            {/* Lista de clientes */}
            {getFilteredCustomers().length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {getFilteredCustomers().map((customer) => (
                  <Card 
                    key={customer.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedCustomer?.id === customer.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.cpfCnpj ? formatCpfCnpj(customer.cpfCnpj) : 'Sem CPF/CNPJ'}
                          </p>
                        </div>
                        {customer.source && customer.source !== 'asaas' && (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="text-xs">
                              {customer.source === 'advbox' ? 'ADVBox' : customer.source === 'contrato' ? 'Contrato' : 'Financeiro'}
                            </Badge>
                            {customer.productName && (
                              <span className="text-xs text-muted-foreground">{customer.productName}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {customerSearch.length >= 2 && getFilteredCustomers().length === 0 && !searchingCustomer && !loadingAdvbox && !loadingLocal && !loadingContracts && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum cliente encontrado
              </p>
            )}

            {customerSource !== 'asaas' && customerSearch.length < 2 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Digite pelo menos 2 caracteres para buscar
              </p>
            )}
          </div>
        )}

        {step === 2 && selectedCustomer && (
          <div className="space-y-4">
            {/* Cliente selecionado */}
            <Card className="bg-muted">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedCustomer.name}</p>
                    <p className="text-sm">{selectedCustomer.cpfCnpj ? formatCpfCnpj(selectedCustomer.cpfCnpj) : 'Sem CPF/CNPJ'}</p>
                  </div>
                  {selectedCustomer.source && selectedCustomer.source !== 'asaas' && (
                    <Badge variant="outline">
                      {selectedCustomer.source === 'advbox' ? 'ADVBox' : selectedCustomer.source === 'contrato' ? 'Contrato' : 'Financeiro'}
                    </Badge>
                  )}
                </div>
                {selectedCustomer.source && selectedCustomer.source !== 'asaas' && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Cliente será sincronizado com Asaas automaticamente
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tipo de cobrança */}
            <div>
              <Label className="mb-2 block">Forma de Pagamento</Label>
              <RadioGroup 
                value={billingType} 
                onValueChange={(v) => setBillingType(v as any)}
                className="grid grid-cols-3 gap-2"
              >
                <div>
                  <RadioGroupItem value="BOLETO" id="boleto" className="peer sr-only" />
                  <Label 
                    htmlFor="boleto"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <FileText className="h-6 w-6 mb-2" />
                    <span className="text-sm">Boleto</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="CREDIT_CARD" id="credit" className="peer sr-only" />
                  <Label 
                    htmlFor="credit"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <CreditCard className="h-6 w-6 mb-2" />
                    <span className="text-sm">Cartão</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                  <Label 
                    htmlFor="pix"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <QrCode className="h-6 w-6 mb-2" />
                    <span className="text-sm">PIX</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Valor e Vencimento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Valor Total (R$) *</Label>
                <Input
                  id="value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Vencimento *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Parcelamento (apenas boleto e cartão) */}
            {(billingType === 'BOLETO' || billingType === 'CREDIT_CARD') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="installments">Parcelas</Label>
                  <Select value={installmentCount} onValueChange={setInstallmentCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">À vista</SelectItem>
                      {Array.from({ length: billingType === 'CREDIT_CARD' ? 20 : 11 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x de R$ {(installmentValue).toFixed(2).replace('.', ',')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {numInstallments > 1 && (
                  <div className="flex items-end">
                    <p className="text-sm text-muted-foreground pb-2">
                      {numInstallments}x de R$ {installmentValue.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Descrição */}
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da cobrança..."
                rows={2}
              />
            </div>

            {/* Opcionais (multa, juros, desconto) */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Configurações avançadas (multa, juros, desconto)
              </summary>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="discountValue">Desconto (R$)</Label>
                  <Input
                    id="discountValue"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="discountDays">Dias antes do venc.</Label>
                  <Input
                    id="discountDays"
                    type="number"
                    value={discountDays}
                    onChange={(e) => setDiscountDays(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="fineValue">Multa (%)</Label>
                  <Input
                    id="fineValue"
                    value={fineValue}
                    onChange={(e) => setFineValue(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="interestValue">Juros ao mês (%)</Label>
                  <Input
                    id="interestValue"
                    value={interestValue}
                    onChange={(e) => setInterestValue(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => setStep(2)} 
                disabled={!selectedCustomer}
              >
                Continuar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={saving || syncingCustomer}>
                {(saving || syncingCustomer) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {syncingCustomer ? 'Sincronizando...' : saving ? 'Criando...' : 'Criar Cobrança'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
