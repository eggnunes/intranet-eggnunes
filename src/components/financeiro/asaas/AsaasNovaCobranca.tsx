import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { 
  Loader2, 
  Search, 
  FileText, 
  CreditCard,
  QrCode,
  Plus
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  cpfCnpj: string;
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
  
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
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

  const searchCustomers = async () => {
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
      setCustomers(data.data || []);
    } catch (error: any) {
      toast.error('Erro ao buscar clientes');
    } finally {
      setSearchingCustomer(false);
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
      const paymentData: Record<string, any> = {
        customer: selectedCustomer.id,
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
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
              />
              <Button onClick={searchCustomers} disabled={searchingCustomer}>
                {searchingCustomer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {customers.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customers.map((customer) => (
                  <Card 
                    key={customer.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedCustomer?.id === customer.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <CardContent className="p-3">
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCpfCnpj(customer.cpfCnpj)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {customerSearch && customers.length === 0 && !searchingCustomer && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum cliente encontrado
              </p>
            )}
          </div>
        )}

        {step === 2 && selectedCustomer && (
          <div className="space-y-4">
            {/* Cliente selecionado */}
            <Card className="bg-muted">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm">{formatCpfCnpj(selectedCustomer.cpfCnpj)}</p>
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
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Cobrança
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
