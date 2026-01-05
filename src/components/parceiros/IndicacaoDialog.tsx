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
    valor_total_causa: '',
    status: 'ativa'
  });

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
          valor_total_causa: indicacao.valor_total_causa ? String(indicacao.valor_total_causa) : '',
          status: indicacao.status
        });
      } else {
        // Definir tipo padrão baseado no tipo do parceiro
        const tipoDefault = parceiroTipo === 'indicamos' ? 'enviada' : 
                           parceiroTipo === 'nos_indicam' ? 'recebida' : 'enviada';
        setFormData({
          tipo_indicacao: tipoDefault,
          nome_cliente: '',
          descricao_caso: '',
          area_atuacao_id: '',
          percentual_comissao: '0',
          valor_total_causa: '',
          status: 'ativa'
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

  const handleSave = async () => {
    if (!formData.nome_cliente.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const valorTotal = formData.valor_total_causa ? parseFloat(formData.valor_total_causa) : null;
      const percentual = parseFloat(formData.percentual_comissao) || 0;
      const valorComissao = valorTotal ? (valorTotal * percentual / 100) : null;

      const payload = {
        parceiro_id: parceiroId,
        tipo_indicacao: formData.tipo_indicacao,
        nome_cliente: formData.nome_cliente,
        descricao_caso: formData.descricao_caso || null,
        area_atuacao_id: formData.area_atuacao_id || null,
        percentual_comissao: percentual,
        valor_total_causa: valorTotal,
        valor_comissao: valorComissao,
        status: formData.status,
        created_by: user?.id
      };

      if (indicacao) {
        const { error } = await supabase
          .from('parceiros_indicacoes')
          .update(payload)
          .eq('id', indicacao.id);

        if (error) throw error;
        toast.success('Indicação atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('parceiros_indicacoes')
          .insert(payload);

        if (error) throw error;
        toast.success('Indicação cadastrada com sucesso!');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
              <Label htmlFor="valor">Valor Total da Causa (R$)</Label>
              <Input
                id="valor"
                type="number"
                value={formData.valor_total_causa}
                onChange={(e) => setFormData({ ...formData, valor_total_causa: e.target.value })}
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

          {formData.valor_total_causa && parseFloat(formData.percentual_comissao) > 0 && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Valor da Comissão: <strong className="text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(parseFloat(formData.valor_total_causa) * parseFloat(formData.percentual_comissao) / 100)}
                </strong>
              </p>
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
