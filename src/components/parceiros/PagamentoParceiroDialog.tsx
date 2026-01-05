import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format, addMonths } from 'date-fns';

interface Indicacao {
  id: string;
  nome_cliente: string;
  valor_comissao: number | null;
}

interface PagamentoParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiroId: string;
  parceiroTipo: string;
  indicacoes: Indicacao[];
  onSuccess: () => void;
}

export function PagamentoParceiroDialog({ open, onOpenChange, parceiroId, parceiroTipo, indicacoes, onSuccess }: PagamentoParceiroDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'receber' as 'receber' | 'pagar',
    indicacao_id: '',
    valor: '',
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: '',
    total_parcelas: '1',
    observacoes: ''
  });

  useEffect(() => {
    if (open) {
      // Definir tipo padrão baseado no tipo do parceiro
      const tipoDefault = parceiroTipo === 'indicamos' ? 'receber' : 
                         parceiroTipo === 'nos_indicam' ? 'pagar' : 'receber';
      setFormData({
        tipo: tipoDefault,
        indicacao_id: '',
        valor: '',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: '',
        total_parcelas: '1',
        observacoes: ''
      });
    }
  }, [open, parceiroTipo]);

  const handleIndicacaoChange = (indicacaoId: string) => {
    setFormData(prev => ({ ...prev, indicacao_id: indicacaoId }));
    
    // Se selecionou uma indicação, preencher valor automaticamente
    const indicacao = indicacoes.find(i => i.id === indicacaoId);
    if (indicacao?.valor_comissao) {
      setFormData(prev => ({ ...prev, valor: String(indicacao.valor_comissao) }));
    }
  };

  const handleSave = async () => {
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      toast.error('Valor é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const totalParcelas = parseInt(formData.total_parcelas) || 1;
      const valorTotal = parseFloat(formData.valor);
      const valorParcela = valorTotal / totalParcelas;

      // Criar pagamentos parcelados
      const pagamentos = [];
      for (let i = 0; i < totalParcelas; i++) {
        const dataVencimento = addMonths(new Date(formData.data_vencimento), i);
        pagamentos.push({
          parceiro_id: parceiroId,
          indicacao_id: formData.indicacao_id || null,
          tipo: formData.tipo,
          valor: valorParcela,
          data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
          forma_pagamento: formData.forma_pagamento || null,
          parcela_atual: i + 1,
          total_parcelas: totalParcelas,
          observacoes: formData.observacoes || null,
          created_by: user?.id
        });
      }

      const { error } = await supabase
        .from('parceiros_pagamentos')
        .insert(pagamentos);

      if (error) throw error;

      toast.success(`${totalParcelas} pagamento(s) criado(s) com sucesso!`);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      toast.error('Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Pagamento</DialogTitle>
          <DialogDescription>
            Registre um pagamento a receber ou a pagar relacionado ao parceiro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo *</Label>
            <Select 
              value={formData.tipo} 
              onValueChange={(v: 'receber' | 'pagar') => setFormData({ ...formData, tipo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(parceiroTipo === 'indicamos' || parceiroTipo === 'ambos') && (
                  <SelectItem value="receber">A Receber (parceiro nos paga)</SelectItem>
                )}
                {(parceiroTipo === 'nos_indicam' || parceiroTipo === 'ambos') && (
                  <SelectItem value="pagar">A Pagar (pagamos ao parceiro)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {indicacoes.length > 0 && (
            <div>
              <Label>Indicação Relacionada</Label>
              <Select 
                value={formData.indicacao_id} 
                onValueChange={handleIndicacaoChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {indicacoes.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.nome_cliente} 
                      {ind.valor_comissao && ` - R$ ${ind.valor_comissao.toFixed(2)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor">Valor Total (R$) *</Label>
              <Input
                id="valor"
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="parcelas">Número de Parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min="1"
                max="60"
                value={formData.total_parcelas}
                onChange={(e) => setFormData({ ...formData, total_parcelas: e.target.value })}
              />
            </div>
          </div>

          {parseInt(formData.total_parcelas) > 1 && formData.valor && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Valor por parcela: <strong className="text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(parseFloat(formData.valor) / parseInt(formData.total_parcelas))}
                </strong>
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="vencimento">Data do 1º Vencimento *</Label>
            <Input
              id="vencimento"
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="forma">Forma de Pagamento</Label>
            <Input
              id="forma"
              value={formData.forma_pagamento}
              onChange={(e) => setFormData({ ...formData, forma_pagamento: e.target.value })}
              placeholder="Ex: PIX, Transferência, Boleto..."
            />
          </div>

          <div>
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações sobre o pagamento..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Pagamento(s)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
