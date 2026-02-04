import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, PieChart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RateioItem {
  id: string;
  categoriaId: string;
  setorId: string;
  centroCustoId: string;
  percentual: number;
  valor: number;
}

interface Categoria {
  id: string;
  nome: string;
}

interface Setor {
  id: string;
  nome: string;
}

interface CentroCusto {
  id: string;
  nome: string;
}

interface RateioLancamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valorTotal: number;
  onConfirm: (rateios: RateioItem[]) => void;
}

export function RateioLancamentoDialog({ 
  open, 
  onOpenChange, 
  valorTotal, 
  onConfirm 
}: RateioLancamentoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [rateios, setRateios] = useState<RateioItem[]>([
    { id: crypto.randomUUID(), categoriaId: '', setorId: '', centroCustoId: '', percentual: 100, valor: valorTotal }
  ]);

  useEffect(() => {
    if (open) {
      fetchData();
      // Reset rateios quando abrir
      setRateios([
        { id: crypto.randomUUID(), categoriaId: '', setorId: '', centroCustoId: '', percentual: 100, valor: valorTotal }
      ]);
    }
  }, [open, valorTotal]);

  const fetchData = async () => {
    const [catRes, setRes, ccRes] = await Promise.all([
      supabase.from('fin_categorias').select('id, nome').eq('ativa', true).order('nome'),
      supabase.from('fin_setores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('fin_centros_custo').select('id, nome').eq('ativo', true).order('nome'),
    ]);

    setCategorias(catRes.data || []);
    setSetores(setRes.data || []);
    setCentrosCusto(ccRes.data || []);
  };

  const addRateio = () => {
    const novoRateio: RateioItem = {
      id: crypto.randomUUID(),
      categoriaId: '',
      setorId: '',
      centroCustoId: '',
      percentual: 0,
      valor: 0
    };
    setRateios([...rateios, novoRateio]);
  };

  const removeRateio = (id: string) => {
    if (rateios.length <= 1) {
      toast.error('É necessário ter pelo menos um rateio');
      return;
    }
    setRateios(rateios.filter(r => r.id !== id));
  };

  const updateRateio = (id: string, field: keyof RateioItem, value: string | number) => {
    setRateios(rateios.map(r => {
      if (r.id !== id) return r;
      
      const updated = { ...r, [field]: value };
      
      // Se mudou o percentual, recalcula o valor
      if (field === 'percentual') {
        updated.valor = (valorTotal * Number(value)) / 100;
      }
      // Se mudou o valor, recalcula o percentual
      if (field === 'valor') {
        updated.percentual = valorTotal > 0 ? (Number(value) / valorTotal) * 100 : 0;
      }
      
      return updated;
    }));
  };

  const distribuirIgualmente = () => {
    const percentualIgual = 100 / rateios.length;
    const valorIgual = valorTotal / rateios.length;
    
    setRateios(rateios.map(r => ({
      ...r,
      percentual: percentualIgual,
      valor: valorIgual
    })));
  };

  const totalPercentual = rateios.reduce((acc, r) => acc + r.percentual, 0);
  const totalValor = rateios.reduce((acc, r) => acc + r.valor, 0);
  const isValid = Math.abs(totalPercentual - 100) < 0.01;

  const handleConfirm = () => {
    if (!isValid) {
      toast.error('A soma dos percentuais deve ser 100%');
      return;
    }
    
    // Validar que cada rateio tem pelo menos uma categoria
    const invalidos = rateios.filter(r => !r.categoriaId);
    if (invalidos.length > 0) {
      toast.error('Todos os rateios devem ter uma categoria selecionada');
      return;
    }

    onConfirm(rateios);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCurrencyInput = (value: number) => {
    if (value === 0) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    // Remove tudo exceto números, vírgula e ponto
    const cleaned = value.replace(/[^\d,.-]/g, '');
    // Substitui vírgula por ponto para conversão
    const normalized = cleaned.replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Rateio do Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Valor Total</div>
                  <div className="text-2xl font-bold">{formatCurrency(valorTotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Percentual Alocado</div>
                  <div className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {totalPercentual.toFixed(1)}%
                  </div>
                </div>
                <Button variant="outline" onClick={distribuirIgualmente}>
                  Distribuir Igualmente
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instrução */}
          <p className="text-sm text-muted-foreground text-center">
            💡 Você pode digitar o <strong>percentual</strong> ou o <strong>valor</strong> - o outro será calculado automaticamente.
          </p>

          {/* Lista de Rateios */}
          <div className="space-y-3">
            {rateios.map((rateio, index) => (
              <Card key={rateio.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <Badge variant="outline" className="mt-2">{index + 1}</Badge>
                    
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Categoria */}
                      <div className="space-y-1">
                        <Label className="text-xs">Categoria *</Label>
                        <Select 
                          value={rateio.categoriaId} 
                          onValueChange={(v) => updateRateio(rateio.id, 'categoriaId', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Setor */}
                      <div className="space-y-1">
                        <Label className="text-xs">Setor</Label>
                        <Select 
                          value={rateio.setorId} 
                          onValueChange={(v) => updateRateio(rateio.id, 'setorId', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {setores.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Percentual */}
                      <div className="space-y-1">
                        <Label className="text-xs">Percentual</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={rateio.percentual > 0 ? rateio.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : ''}
                            onChange={(e) => {
                              const val = parseCurrencyInput(e.target.value);
                              updateRateio(rateio.id, 'percentual', val);
                            }}
                            className="h-9 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                      </div>

                      {/* Valor */}
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={formatCurrencyInput(rateio.valor)}
                            onChange={(e) => {
                              const val = parseCurrencyInput(e.target.value);
                              updateRateio(rateio.id, 'valor', val);
                            }}
                            className="h-9 pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeRateio(rateio.id)}
                      disabled={rateios.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" onClick={addRateio} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Rateio
          </Button>

          {/* Aviso de validação */}
          {!isValid && (
            <p className="text-sm text-destructive text-center">
              A soma dos percentuais ({totalPercentual.toFixed(1)}%) deve ser igual a 100%
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Confirmar Rateio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
