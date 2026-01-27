import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { addMonths, format } from 'date-fns';

interface AreaAtuacao {
  id: string;
  nome: string;
}

interface Indicacao {
  id: string;
  tipo_indicacao: string;
  nome_cliente: string;
  descricao_caso: string | null;
  percentual_comissao: number;
  valor_total_causa: number | null;
  valor_comissao: number | null;
  status: string;
  data_indicacao: string;
  area: { nome: string } | null;
}

interface IndicacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiroId: string;
  parceiroTipo: string;
  indicacao: Indicacao | null;
  onSuccess: () => void;
}

export function IndicacaoDialog({ open, onOpenChange, parceiroId, parceiroTipo, indicacao, onSuccess }: IndicacaoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState<AreaAtuacao[]>([]);
  const [formData, setFormData] = useState({
    tipo_indicacao: 'enviada',
    nome_cliente: '',
    descricao_caso: '',
    area_atuacao_id: '',
    percentual_comissao: '0',
    valor_honorarios: '',
    status: 'ativa',
    forma_pagamento: 'avista',
    numero_parcelas: '1',
    pago_no_ato: false
  });

  const valorHonorarios = parseFloat(formData.valor_honorarios) || 0;
  const percentualComissao = parseFloat(formData.percentual_comissao) || 0;
  const valorComissao = valorHonorarios * percentualComissao / 100;
  const valorLiquidoEscritorio = valorHonorarios - valorComissao;

  useEffect(() => {
    if (open) {
      fetchAreas();
      if (indicacao) {
        setFormData({
          tipo_indicacao: indicacao.tipo_indicacao as string,
          nome_cliente: indicacao.nome_cliente,
          descricao_caso: indicacao.descricao_caso || '',
          area_atuacao_id: '',
          percentual_comissao: String(indicacao.percentual_comissao),
          valor_honorarios: indicacao.valor_total_causa ? String(indicacao.valor_total_causa) : '',
          status: indicacao.status,
          forma_pagamento: 'avista',
          numero_parcelas: '1',
          pago_no_ato: false
        });
      } else {
        const tipoDefault = parceiroTipo === 'indicamos' ? 'enviada' : 
                           parceiroTipo === 'nos_indicam' ? 'recebida' : 'enviada';
        setFormData({
          tipo_indicacao: tipoDefault,
          nome_cliente: '',
          descricao_caso: '',
          area_atuacao_id: '',
          percentual_comissao: '0',
          valor_honorarios: '',
          status: 'ativa',
          forma_pagamento: 'avista',
          numero_parcelas: '1',
          pago_no_ato: false
        });
      }
    }
  }, [open, indicacao, parceiroTipo]);

  const fetchAreas = async () => {
    const { data, error } = await supabase
      .from('parceiros_areas_atuacao')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao carregar áreas:', error);
      return;
    }
    setAreas(data || []);
  };

  const criarLancamentosFinanceiros = async (indicacaoId: string, parceiroNome: string) => {
    if (valorLiquidoEscritorio <= 0) return;

    try {
      // Buscar categoria de receita padrão
      let { data: categoria } = await supabase
        .from('fin_categorias')
        .select('id')
        .eq('tipo', 'receita')
        .eq('ativa', true)
        .limit(1)
        .single();

      if (!categoria) {
        const { data: novaCat } = await supabase
          .from('fin_categorias')
          .insert({ nome: 'Honorários de Parceiros', tipo: 'receita', grupo: 'Receitas', cor: '#22c55e', ativa: true })
          .select('id')
          .single();
        categoria = novaCat;
      }

      // Buscar conta padrão
      const { data: conta } = await supabase
        .from('fin_contas')
        .select('id')
        .eq('ativa', true)
        .limit(1)
        .single();

      const numParcelas = formData.forma_pagamento === 'parcelado' ? parseInt(formData.numero_parcelas) || 1 : 1;
      const valorParcela = valorLiquidoEscritorio / numParcelas;
      const hoje = new Date();

      const lancamentos = [];
      for (let i = 0; i < numParcelas; i++) {
        const dataVencimento = addMonths(hoje, i);
        const isPago = formData.forma_pagamento === 'avista' && formData.pago_no_ato && i === 0;
        
        lancamentos.push({
          tipo: 'receita',
          categoria_id: categoria?.id,
          conta_origem_id: conta?.id,
          valor: valorParcela,
          descricao: `Honorários - ${formData.nome_cliente} (Parceiro: ${parceiroNome})${numParcelas > 1 ? ` - Parcela ${i + 1}/${numParcelas}` : ''}`,
          data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
          data_pagamento: isPago ? format(hoje, 'yyyy-MM-dd') : null,
          origem: 'cliente',
          status: isPago ? 'pago' : 'pendente',
          observacao: `Indicação ID: ${indicacaoId}`,
          created_by: user?.id
        });
      }

      const { error } = await supabase.from('fin_lancamentos').insert(lancamentos);
      if (error) throw error;

      toast.success(`${numParcelas} lançamento(s) financeiro(s) criado(s)!`);
    } catch (error) {
      console.error('Erro ao criar lançamentos:', error);
      toast.error('Indicação salva, mas houve erro ao criar lançamentos financeiros');
    }
  };

  const handleSave = async () => {
    if (!formData.nome_cliente.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        parceiro_id: parceiroId,
        tipo_indicacao: formData.tipo_indicacao,
        nome_cliente: formData.nome_cliente,
        descricao_caso: formData.descricao_caso || null,
        area_atuacao_id: formData.area_atuacao_id || null,
        percentual_comissao: percentualComissao,
        valor_total_causa: valorHonorarios || null,
        valor_comissao: valorComissao || null,
        status: formData.status,
        created_by: user?.id
      };

      // Buscar nome do parceiro
      const { data: parceiro } = await supabase
        .from('parceiros')
        .select('nome_completo')
        .eq('id', parceiroId)
        .single();

      if (indicacao) {
        const { error } = await supabase
          .from('parceiros_indicacoes')
          .update(payload)
          .eq('id', indicacao.id);

        if (error) throw error;
        toast.success('Indicação atualizada com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('parceiros_indicacoes')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;
        toast.success('Indicação cadastrada com sucesso!');

        // Criar lançamentos financeiros automaticamente
        if (data && valorLiquidoEscritorio > 0) {
          await criarLancamentosFinanceiros(data.id, parceiro?.nome_completo || 'Parceiro');
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar indicação:', error);
      toast.error('Erro ao salvar indicação');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{indicacao ? 'Editar Indicação' : 'Nova Indicação'}</DialogTitle>
          <DialogDescription>
            Registre uma causa indicada para ou pelo parceiro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de Indicação *</Label>
            <Select 
              value={formData.tipo_indicacao} 
              onValueChange={(v: 'enviada' | 'recebida') => setFormData({ ...formData, tipo_indicacao: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(parceiroTipo === 'indicamos' || parceiroTipo === 'ambos') && (
                  <SelectItem value="enviada">Causa Enviada (nós indicamos)</SelectItem>
                )}
                {(parceiroTipo === 'nos_indicam' || parceiroTipo === 'ambos') && (
                  <SelectItem value="recebida">Causa Recebida (nos indicaram)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cliente">Nome do Cliente *</Label>
            <Input
              id="cliente"
              value={formData.nome_cliente}
              onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
              placeholder="Nome do cliente indicado"
            />
          </div>

          <div>
            <Label>Área de Atuação</Label>
            <Select 
              value={formData.area_atuacao_id} 
              onValueChange={(v) => setFormData({ ...formData, area_atuacao_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>{area.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor">Valor dos Honorários (R$)</Label>
              <Input
                id="valor"
                type="number"
                value={formData.valor_honorarios}
                onChange={(e) => setFormData({ ...formData, valor_honorarios: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="percentual">Comissão (%)</Label>
              <Input
                id="percentual"
                type="number"
                min="0"
                max="100"
                value={formData.percentual_comissao}
                onChange={(e) => setFormData({ ...formData, percentual_comissao: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          {valorHonorarios > 0 && (
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="text-sm text-muted-foreground">
                Valor da Comissão: <strong className="text-foreground">{formatCurrency(valorComissao)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Valor Líquido Escritório: <strong className="text-primary">{formatCurrency(valorLiquidoEscritorio)}</strong>
              </p>
            </div>
          )}

          <div>
            <Label>Forma de Pagamento</Label>
            <Select 
              value={formData.forma_pagamento} 
              onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v, pago_no_ato: false })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avista">À Vista</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.forma_pagamento === 'avista' && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <Label htmlFor="pago_ato" className="cursor-pointer">Pago no ato?</Label>
              <Switch
                id="pago_ato"
                checked={formData.pago_no_ato}
                onCheckedChange={(checked) => setFormData({ ...formData, pago_no_ato: checked })}
              />
            </div>
          )}

          {formData.forma_pagamento === 'parcelado' && (
            <div>
              <Label htmlFor="parcelas">Número de Parcelas</Label>
              <Input
                id="parcelas"
                type="number"
                min="2"
                max="48"
                value={formData.numero_parcelas}
                onChange={(e) => setFormData({ ...formData, numero_parcelas: e.target.value })}
                placeholder="2"
              />
              {parseInt(formData.numero_parcelas) > 1 && valorLiquidoEscritorio > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.numero_parcelas}x de {formatCurrency(valorLiquidoEscritorio / parseInt(formData.numero_parcelas))}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição do Caso</Label>
            <Textarea
              id="descricao"
              value={formData.descricao_caso}
              onChange={(e) => setFormData({ ...formData, descricao_caso: e.target.value })}
              placeholder="Descreva brevemente o caso..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}